import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptNote,
  encodeKeyFragment,
  encryptNote,
  generateIv,
  generateNoteKey,
} from '../public/assets/crypto.js'

const IV_BYTES = 12
const KEY_BYTES = 32

describe('base64url helpers', () => {
  it('round trips arbitrary bytes', () => {
    const original = new Uint8Array(256)
    for (let index = 0; index < 256; index += 1) {
      original[index] = index
    }
    assert.deepEqual(base64UrlToBytes(bytesToBase64Url(original)), original)
  })

  it('emits no padding and no url unsafe characters', () => {
    for (let size = 0; size < 40; size += 1) {
      const bytes = new Uint8Array(size).fill(0xfb)
      const encoded = bytesToBase64Url(bytes)
      assert.doesNotMatch(encoded, /[+/=]/)
    }
  })

  it('survives values that encode to plus and slash', () => {
    const bytes = base64UrlToBytes('++//')
    assert.match(bytesToBase64Url(bytes), /^[A-Za-z0-9_-]+$/)
  })

  it('handles an empty input', () => {
    assert.deepEqual(base64UrlToBytes(''), new Uint8Array(0))
  })
})

describe('key and iv generation', () => {
  it('produces a 256 bit key', () => {
    assert.equal(generateNoteKey().length, KEY_BYTES)
  })

  it('produces a 96 bit iv', () => {
    assert.equal(generateIv().length, IV_BYTES)
  })

  it('produces a different key and iv every call', () => {
    assert.notDeepEqual(generateNoteKey(), generateNoteKey())
    assert.notDeepEqual(generateIv(), generateIv())
  })

  it('encodes a key to a 43 character fragment', () => {
    assert.equal(encodeKeyFragment(generateNoteKey()).length, 43)
  })
})

describe('encrypt and decrypt', () => {
  it('round trips text', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote('correct horse battery staple', key, iv)
    assert.equal(await decryptNote(ciphertext, bytesToBase64Url(iv), key), 'correct horse battery staple')
  })

  it('round trips unicode and newlines', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const text = 'pässwörd\nsecond line\ttabbed\n日本語\nemoji key 🔑'
    const ciphertext = await encryptNote(text, key, iv)
    assert.equal(await decryptNote(ciphertext, bytesToBase64Url(iv), key), text)
  })

  it('round trips an empty note', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote('', key, iv)
    assert.equal(await decryptNote(ciphertext, bytesToBase64Url(iv), key), '')
  })

  it('produces ciphertext that hides the plaintext', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote('hunter2', key, iv)
    assert.equal(ciphertext.includes('hunter2'), false)
    assert.doesNotMatch(ciphertext, /[+/=]/)
  })

  it('gives different ciphertext for the same text and key', async () => {
    const key = generateNoteKey()
    const first = await encryptNote('same', key, generateIv())
    const second = await encryptNote('same', key, generateIv())
    assert.notEqual(first, second)
  })

  it('refuses to decrypt with the wrong key', async () => {
    const iv = generateIv()
    const ciphertext = await encryptNote('hunter2', generateNoteKey(), iv)
    await assert.rejects(() => decryptNote(ciphertext, bytesToBase64Url(iv), generateNoteKey()))
  })

  it('refuses to decrypt when the key fragment is wrong', async () => {
    const iv = generateIv()
    const ciphertext = await encryptNote('hunter2', generateNoteKey(), iv)
    const wrongFragment = encodeKeyFragment(generateNoteKey())
    await assert.rejects(() => decryptNote(ciphertext, bytesToBase64Url(iv), base64UrlToBytes(wrongFragment)))
  })

  it('refuses to decrypt when the ciphertext is damaged', async () => {
    const key = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote('hunter2', key, iv)
    const damaged = `${ciphertext.slice(0, -4)}AAAA`
    await assert.rejects(() => decryptNote(damaged, bytesToBase64Url(iv), key))
  })
})
