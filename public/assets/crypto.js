const encoder = new TextEncoder()
const decoder = new TextDecoder()

const KEY_BYTES = 32
const IV_BYTES = 12

export function bytesToBase64Url(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (padded.length % 4)) % 4
  const binary = atob(padded + '='.repeat(padding))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function generateNoteKey() {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES))
}

export function generateIv() {
  return crypto.getRandomValues(new Uint8Array(IV_BYTES))
}

export function encodeKeyFragment(rawKey) {
  return bytesToBase64Url(rawKey)
}

export function decodeKeyFragment(fragment) {
  return base64UrlToBytes(fragment)
}

async function importKey(rawKey) {
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptNote(plaintext, rawKey, iv) {
  const key = await importKey(rawKey)
  const data = encoder.encode(plaintext)
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return bytesToBase64Url(new Uint8Array(sealed))
}

export async function decryptNote(ciphertext, iv, rawKey) {
  const key = await importKey(rawKey)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(iv) },
    key,
    base64UrlToBytes(ciphertext),
  )
  return decoder.decode(plain)
}
