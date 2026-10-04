import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { unlinkSync } from 'node:fs'

const DB_FILE = 'test-api.db'
const BASE = 'http://localhost'

process.env.DATABASE_URL = `file:${DB_FILE}`
process.env.TURSO_AUTH_TOKEN = ''
process.env.TRUST_PROXY = ''

const { initDatabase, db, closeDatabase } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { resetApiRateLimiters } = await import('../src/routes/api.js')
const { encryptNote, generateIv, generateNoteKey, bytesToBase64Url } = await import(
  '../public/assets/crypto.js'
)

const app = createApp()

const NOT_FOUND_BODY = '{"error":"not_found"}'

function call(path, init) {
  return app.request(BASE + path, init)
}

function postJson(path, body) {
  return call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function makeNote(plaintext = 'hunter2', ttl = '1h', burnMode = undefined) {
  const key = generateNoteKey()
  const iv = generateIv()
  const ciphertext = await encryptNote(plaintext, key, iv)
  const body = {
    ciphertext,
    iv: bytesToBase64Url(iv),
    ttl,
  }
  if (burnMode !== undefined) {
    body.burnMode = burnMode
  }
  const response = await postJson('/api/notes', body)
  assert.equal(response.status, 201)
  const { id } = await response.json()
  return { id, key, ciphertext, iv: bytesToBase64Url(iv) }
}

function readNote(id) {
  return call(`/api/notes/${id}/read`, { method: 'POST' })
}

function peekNote(id) {
  return call(`/api/notes/${id}/peek`, { method: 'POST' })
}

function expiryOf(id) {
  return call(`/api/notes/${id}/expiry`)
}

before(async () => {
  await initDatabase()
})

beforeEach(() => {
  resetApiRateLimiters()
})

after(() => {
  closeDatabase()
  try {
    unlinkSync(DB_FILE)
  } catch {
    // Already gone.
  }
})

describe('POST /api/notes', () => {
  it('creates a note and returns a 22 character id', async () => {
    const { id } = await makeNote()
    assert.match(id, /^[A-Za-z0-9_-]{22}$/)
  })

  it('gives two notes different ids', async () => {
    const first = await makeNote()
    const second = await makeNote()
    assert.notEqual(first.id, second.id)
  })

  it('rejects an oversized ciphertext with 413', async () => {
    const response = await postJson('/api/notes', {
      ciphertext: 'A'.repeat(21849),
      iv: 'a'.repeat(16),
      ttl: '1h',
    })
    assert.equal(response.status, 413)
    assert.deepEqual(await response.json(), { error: 'note_too_large' })
  })

  it('accepts a ciphertext at the size limit', async () => {
    const response = await postJson('/api/notes', {
      ciphertext: 'A'.repeat(21848),
      iv: 'a'.repeat(16),
      ttl: '1h',
    })
    assert.equal(response.status, 201)
  })

  it('rejects an unknown ttl', async () => {
    const response = await postJson('/api/notes', {
      ciphertext: 'AAAA',
      iv: 'a'.repeat(16),
      ttl: '99y',
    })
    assert.equal(response.status, 400)
  })

  it('rejects a short iv', async () => {
    const response = await postJson('/api/notes', {
      ciphertext: 'AAAA',
      iv: 'short',
      ttl: '1h',
    })
    assert.equal(response.status, 400)
  })

  it('rejects ciphertext that is not base64url', async () => {
    const response = await postJson('/api/notes', {
      ciphertext: 'has spaces and +plus/',
      iv: 'a'.repeat(16),
      ttl: '1h',
    })
    assert.equal(response.status, 400)
  })

  it('rejects an empty body', async () => {
    const response = await call('/api/notes', { method: 'POST' })
    assert.equal(response.status, 400)
  })

  it('rejects a body that is not an object', async () => {
    const response = await postJson('/api/notes', ['nope'])
    assert.equal(response.status, 400)
  })

  it('rejects an oversized body before touching the database', async () => {
    const response = await call('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciphertext: 'A'.repeat(200000), iv: 'a'.repeat(16), ttl: '1h' }),
    })
    assert.equal(response.status, 413)
  })
})

describe('POST /api/notes/:id/read', () => {
  it('returns the ciphertext and iv on the first read', async () => {
    const { id, ciphertext, iv } = await makeNote('first read wins')
    const response = await readNote(id)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ciphertext, ciphertext)
    assert.equal(body.iv, iv)
    assert.equal(body.score.chars, 'first read wins'.length)
  })

  it('returns 404 on the second read', async () => {
    const { id } = await makeNote()
    await readNote(id)
    const second = await readNote(id)
    assert.equal(second.status, 404)
    assert.equal(await second.text(), NOT_FOUND_BODY)
  })

  it('gives a byte identical body for missing, expired and already read', async () => {
    const missing = await readNote('aaaaaaaaaaaaaaaaaaaaaa')
    const missingBody = await missing.text()

    const { id } = await makeNote()
    await readNote(id)
    const alreadyRead = await readNote(id)
    const alreadyReadBody = await alreadyRead.text()

    await db.execute({
      sql: 'INSERT INTO notes (id, ciphertext, iv, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      args: ['bbbbbbbbbbbbbbbbbbbbbb', 'AAAA', 'a'.repeat(16), Date.now() - 7200000, Date.now() - 3600000],
    })
    const expired = await readNote('bbbbbbbbbbbbbbbbbbbbbb')
    const expiredBody = await expired.text()

    assert.equal(missing.status, 404)
    assert.equal(alreadyRead.status, 404)
    assert.equal(expired.status, 404)
    assert.equal(missingBody, alreadyReadBody)
    assert.equal(missingBody, expiredBody)
  })

  it('destroys the row so it cannot be read again', async () => {
    const { id } = await makeNote()
    await readNote(id)
    const remaining = await db.execute({ sql: 'SELECT count(*) AS c FROM notes WHERE id = ?', args: [id] })
    assert.equal(remaining.rows[0].c, 0)
  })

  it('returns 404 for a malformed id', async () => {
    const response = await readNote('not-a-valid-id')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), NOT_FOUND_BODY)
  })

  it('never returns the note over GET', async () => {
    const { id } = await makeNote()
    const response = await call(`/api/notes/${id}/read`)
    assert.equal(response.status, 404)
    const after = await readNote(id)
    assert.equal(after.status, 200)
  })

  it('only one of two concurrent reads succeeds', async () => {
    const { id } = await makeNote('only once')
    const results = await Promise.all([readNote(id), readNote(id)])
    const statuses = results.map((response) => response.status).sort()
    assert.deepEqual(statuses, [200, 404])
  })
})

describe('GET /api/stats', () => {
  it('counts burned notes', async () => {
    const before = await (await call('/api/stats')).json()
    const { id } = await makeNote()
    await readNote(id)
    const after = await (await call('/api/stats')).json()
    assert.equal(after.burned, before.burned + 1)
  })

  it('does not count a failed read', async () => {
    const before = await (await call('/api/stats')).json()
    await readNote('cccccccccccccccccccccc')
    const after = await (await call('/api/stats')).json()
    assert.equal(after.burned, before.burned)
  })

  it('reports xp and characters', async () => {
    const stats = await (await call('/api/stats')).json()
    assert.equal(typeof stats.xp, 'number')
    assert.equal(typeof stats.chars, 'number')
  })
})

describe('burn modes', () => {
  it('defaults to auto', async () => {
    const { id } = await makeNote()
    const described = await (await expiryOf(id)).json()
    assert.equal(described.burnMode, 'auto')
  })

  it('rejects an unknown mode', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote('hunter2', key, iv)
    const response = await postJson('/api/notes', {
      ciphertext,
      iv: bytesToBase64Url(iv),
      ttl: '1h',
      burnMode: 'eternal',
    })
    assert.equal(response.status, 400)
  })

  it('caps a manual note at 24 hours', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote('hunter2', key, iv)
    const response = await postJson('/api/notes', {
      ciphertext,
      iv: bytesToBase64Url(iv),
      ttl: '7d',
      burnMode: 'manual',
    })
    assert.equal(response.status, 400)
  })

  it('accepts a manual note with a short expiry', async () => {
    const { id } = await makeNote('hunter2', '10m', 'manual')
    const described = await (await expiryOf(id)).json()
    assert.equal(described.burnMode, 'manual')
  })

  it('stores the burn mode', async () => {
    const { id } = await makeNote('hunter2', '1h', 'manual')
    const row = await db.execute({
      sql: 'SELECT burn_mode FROM notes WHERE id = ?',
      args: [id],
    })
    assert.equal(row.rows[0].burn_mode, 'manual')
  })
})

describe('GET /api/notes/:id/expiry', () => {
  it('reports the mode and expiry without the ciphertext', async () => {
    const { id } = await makeNote()
    const response = await expiryOf(id)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.burnMode, 'auto')
    assert.equal(typeof body.expiresAt, 'number')
    assert.equal('ciphertext' in body, false)
  })

  it('returns not_found for a note that does not exist', async () => {
    const response = await expiryOf('cccccccccccccccccccccc')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), NOT_FOUND_BODY)
  })
})

describe('POST /api/notes/:id/peek', () => {
  it('leaves a manual note readable', async () => {
    const { id, ciphertext } = await makeNote('peekable', '1h', 'manual')
    const first = await peekNote(id)
    assert.equal(first.status, 200)
    const body = await first.json()
    assert.equal(body.ciphertext, ciphertext)
    assert.equal(body.score, undefined)

    const second = await peekNote(id)
    assert.equal(second.status, 200)
  })

  it('does not burn or score the note', async () => {
    const before = await (await call('/api/stats')).json()
    const { id } = await makeNote('peekable', '1h', 'manual')
    await peekNote(id)
    await peekNote(id)
    const after = await (await call('/api/stats')).json()
    assert.equal(after.burned, before.burned)
    assert.equal(after.xp, before.xp)
  })

  it('refuses to peek at an auto note', async () => {
    const { id } = await makeNote()
    const response = await peekNote(id)
    assert.equal(response.status, 404)
    assert.equal(await response.text(), NOT_FOUND_BODY)
  })

  it('still allows the reader to burn a manual note', async () => {
    const { id } = await makeNote('peekable', '1h', 'manual')
    await peekNote(id)
    assert.equal((await readNote(id)).status, 200)
    assert.equal((await readNote(id)).status, 404)
  })
})

describe('xp scoring', () => {
  it('returns a score with the burn', async () => {
    const { id } = await makeNote('a longer secret worth points', '1h')
    const response = await readNote(id)
    assert.equal(response.status, 200)
    const { score } = await response.json()
    assert.equal(typeof score.xp, 'number')
    assert.equal(typeof score.chars, 'number')
    assert.equal(score.chars, 'a longer secret worth points'.length)
    assert.equal(score.xp, 100 + Math.floor(score.chars / 5))
  })

  it('awards more xp for a longer note', async () => {
    const short = await (await readNote((await makeNote('short', '1h')).id)).json()
    const long = await (
      await readNote((await makeNote('a much much longer secret than the short one', '1h')).id)
    ).json()
    assert.ok(long.score.xp > short.score.xp)
    assert.ok(long.score.chars > short.score.chars)
  })

  it('accumulates xp and chars in stats', async () => {
    const before = await (await call('/api/stats')).json()
    const { id } = await makeNote('twelve chars', '1h')
    const { score } = await (await readNote(id)).json()
    const after = await (await call('/api/stats')).json()
    assert.equal(after.xp, before.xp + score.xp)
    assert.equal(after.chars, before.chars + score.chars)
    assert.equal(after.burned, before.burned + 1)
  })
})

describe('security headers', () => {
  it('sets the policy on api responses', async () => {
    const response = await call('/api/stats')
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('x-frame-options'), 'DENY')
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
  })

  it('sets the policy on note pages', async () => {
    const response = await call('/n/aaaaaaaaaaaaaaaaaaaaaa')
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  })
})

describe('database contents', () => {
  it('stores no plaintext and no key material', async () => {
    const secret = 'PLAINTEXT_CANARY_9f2b'
    const { id, ciphertext, iv } = await makeNote(secret)
    const row = await db.execute({
      sql: 'SELECT ciphertext, iv FROM notes WHERE id = ?',
      args: [id],
    })
    const stored = row.rows[0]
    assert.equal(stored.ciphertext, ciphertext)
    assert.equal(stored.iv, iv)
    assert.equal(JSON.stringify(stored).includes(secret), false)
    assert.equal(JSON.stringify(stored).includes('AES'), false)
  })
})
