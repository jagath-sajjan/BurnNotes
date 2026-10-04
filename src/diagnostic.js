import { existsSync } from 'node:fs'

// Three base64url segments. The segments are kept short because a real token
// can have a small middle segment, and over redacting is the safe direction
// for a safety net.
const TOKEN_LIKE = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g

// A long unbroken base64url run, in case a token is ever logged without dots.
const OPAQUE_BLOB = /\b[A-Za-z0-9_-]{48,}\b/g

// Anything shaped like a bearer token is replaced before a message is allowed
// out of this file.
export function redact(text) {
  return String(text)
    .replace(TOKEN_LIKE, '[redacted token]')
    .replace(OPAQUE_BLOB, '[redacted blob]')
}

function statusFor(error) {
  const text = redact(error?.message ?? String(error)).toLowerCase()
  if (text.includes('401') || text.includes('jwt') || text.includes('auth')) {
    return 'The database rejected the credentials.'
  }
  if (text.includes('404') || text.includes('no such database')) {
    return 'The database url does not exist.'
  }
  if (text.includes('enotfound') || text.includes('fetch failed') || text.includes('econnrefused')) {
    return 'The database host could not be reached.'
  }
  return 'The database rejected a request.'
}

const REMEDY = [
  'Set both variables in the hosting dashboard, then redeploy.',
  '',
  '  TURSO_DATABASE_URL  libsql://<db-name>.<region>.turso.io',
  '  TURSO_AUTH_TOKEN    a token minted for that exact database',
  '',
  'Tokens stop working when a database is recreated, because the signing key',
  'is replaced with it. Mint a new one:',
  '',
  '  npx @turso/cli db tokens create <db-name> --permission rw',
  '',
  'It must be the rw token. A read only token cannot create the schema.',
].join('\n')

export function diagnostic(error) {
  const detail = redact(error?.message ?? String(error)).split('\n')[0]

  return [
    'BurnNotes cannot reach its database.',
    '',
    `What happened: ${statusFor(error)}`,
    `Reported by the driver: ${detail}`,
    '',
    REMEDY,
    '',
    'Nothing is served while the database is unreachable, and no note was',
    'stored or destroyed.',
  ].join('\n')
}

export function isCredentialProblem(error) {
  const text = redact(error?.message ?? String(error)).toLowerCase()
  return text.includes('401') || text.includes('jwt') || text.includes('auth')
}

// Vercel and Render only set these when they are provided. A missing value is
// reported instead of silently falling back to a local file that cannot work
// on a read only filesystem.
export function assertServerEnv() {
  const remote = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || ''
  const missing = []
  if (remote !== '' && !remote.startsWith('file:') && (process.env.TURSO_AUTH_TOKEN ?? '') === '') {
    missing.push('TURSO_AUTH_TOKEN')
  }
  if (remote === '') {
    missing.push('TURSO_DATABASE_URL')
  }
  if (missing.length === 0) return null
  return `Missing environment variable: ${missing.join(', ')}.`
}

export function localFileExists(url) {
  return url.startsWith('file:') && existsSync(url.slice('file:'.length))
}