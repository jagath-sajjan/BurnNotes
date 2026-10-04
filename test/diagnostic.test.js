import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const { assertServerEnv, diagnostic, isCredentialProblem, redact } = await import(
  '../src/diagnostic.js'
)

// Three segments of base64url, which is what a libsql token looks like.
const FAKE_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImFiYyJ9.eyJhIjoicncifQ.c2lnbmF0dXJlLWhlcmU'
const ENV_KEYS = ['DATABASE_URL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']

function withEnv(values, run) {
  const saved = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  Object.assign(process.env, values)
  try {
    return run()
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

describe('redact', () => {
  it('removes anything shaped like a bearer token', () => {
    const out = redact(`failed with ${FAKE_TOKEN} in the header`)
    assert.equal(out.includes(FAKE_TOKEN), false)
    assert.match(out, /\[redacted token\]/)
  })

  it('leaves ordinary text alone', () => {
    assert.equal(redact('HTTP status 401'), 'HTTP status 401')
    assert.equal(redact('Database init failed. getaddrinfo ENOTFOUND db'), 'Database init failed. getaddrinfo ENOTFOUND db')
  })

  it('catches a token logged without dots', () => {
    const bare = 'A'.repeat(60)
    assert.equal(redact(`saw ${bare} here`).includes(bare), false)
  })

  it('catches a token with a short middle segment', () => {
    const short = 'eyJhbGciOiJFUzI1NiJ9.eyJhIjoicncifQ.c2lnbmF0dXJlLWhlcmUtbG9uZw'
    assert.equal(redact(`saw ${short} here`).includes(short), false)
  })
})

describe('diagnostic', () => {
  it('never contains the token even when the error does', () => {
    const body = diagnostic(new Error(`rejected ${FAKE_TOKEN}`))
    assert.equal(body.includes(FAKE_TOKEN), false)
  })

  it('names the credential failure and the remedy', () => {
    const body = diagnostic(new Error('SERVER_ERROR: Server returned HTTP status 401'))
    assert.match(body, /rejected the credentials/)
    assert.match(body, /TURSO_AUTH_TOKEN/)
    assert.match(body, /turso/i)
  })

  it('distinguishes an unreachable host from bad credentials', () => {
    assert.match(diagnostic(new Error('getaddrinfo ENOTFOUND x')), /could not be reached/)
    assert.match(diagnostic(new Error('no such database')), /url does not exist/)
  })
})

describe('isCredentialProblem', () => {
  it('spots auth failures', () => {
    assert.equal(isCredentialProblem(new Error('HTTP status 401')), true)
    assert.equal(isCredentialProblem(new Error('invalid JWT token')), true)
  })

  it('does not claim a timeout is an auth problem', () => {
    assert.equal(isCredentialProblem(new Error('ETIMEDOUT')), false)
  })
})

describe('assertServerEnv', () => {
  it('passes when a local file database is used with no token', () => {
    withEnv({ DATABASE_URL: 'file:local.db' }, () => {
      assert.equal(assertServerEnv(), null)
    })
  })

  it('passes when both remote values are present', () => {
    withEnv({ TURSO_DATABASE_URL: 'libsql://x.turso.io', TURSO_AUTH_TOKEN: 'abc' }, () => {
      assert.equal(assertServerEnv(), null)
    })
  })

  it('names a missing token', () => {
    withEnv({ TURSO_DATABASE_URL: 'libsql://x.turso.io' }, () => {
      assert.match(assertServerEnv(), /TURSO_AUTH_TOKEN/)
    })
  })

  it('names a missing url', () => {
    withEnv({}, () => {
      assert.match(assertServerEnv(), /TURSO_DATABASE_URL/)
    })
  })
})