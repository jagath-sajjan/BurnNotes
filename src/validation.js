export const TTL_SECONDS = {
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
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

  return {
    ok: true,
    value: { ciphertext, iv, ttlSeconds: TTL_SECONDS[ttl] },
  }
}
