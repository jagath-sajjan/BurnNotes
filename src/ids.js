import { randomBytes } from 'node:crypto'

export const ID_BYTES = 16
export const ID_CHARS = 22

export function newNoteId() {
  return randomBytes(ID_BYTES).toString('base64url')
}

const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

export function isValidNoteId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value)
}
