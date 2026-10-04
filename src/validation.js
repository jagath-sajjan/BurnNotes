export const TTL_SECONDS = {
  '10m': 10 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
}

// A manual note stays on the server until the viewer burns it, so it must
// not be allowed to sit around for a week.
export const MANUAL_MAX_TTL_SECONDS = TTL_SECONDS['24h']

export const BURN_MODES = {
  auto: 'auto',
  manual: 'manual',
}

export const MAX_PLAINTEXT_BYTES = 16 * 1024
export const IV_BYTES = 12
export const IV_CHARS = 16
export const MAX_CIPHERTEXT_CHARS = 21848

const BASE64URL = /^[A-Za-z0-9_-]+$/

function isBase64Url(value) {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.length % 4 === 1) return false
  return BASE64URL.test(value)
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCreateBody(body) {
  if (!isPlainObject(body)) {
    return { ok: false, reason: 'body' }
  }

  const { ciphertext, iv, ttl } = body
  const burnMode = body.burnMode === undefined ? BURN_MODES.auto : body.burnMode

  if (typeof burnMode !== 'string' || !Object.hasOwn(BURN_MODES, burnMode)) {
    return { ok: false, reason: 'burnMode' }
  }

  if (typeof ciphertext !== 'string') {
    return { ok: false, reason: 'ciphertext' }
  }
  if (ciphertext.length > MAX_CIPHERTEXT_CHARS) {
    return { ok: false, reason: 'too_large' }
  }
  if (!isBase64Url(ciphertext)) {
    return { ok: false, reason: 'ciphertext' }
  }

  if (typeof iv !== 'string' || iv.length !== IV_CHARS || !isBase64Url(iv)) {
    return { ok: false, reason: 'iv' }
  }

  if (typeof ttl !== 'string' || !Object.hasOwn(TTL_SECONDS, ttl)) {
    return { ok: false, reason: 'ttl' }
  }

  const ttlSeconds = TTL_SECONDS[ttl]

  if (burnMode === BURN_MODES.manual && ttlSeconds > MANUAL_MAX_TTL_SECONDS) {
    return { ok: false, reason: 'ttl' }
  }

  return { ok: true, value: { ciphertext, iv, burnMode, ttlSeconds } }
}
