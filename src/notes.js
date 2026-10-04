import { db } from './db.js'
import { newNoteId } from './ids.js'

export async function createNote({ ciphertext, iv, burnMode, ttlSeconds }, now = Date.now()) {
  const id = newNoteId()
  const expiresAt = now + ttlSeconds * 1000

  await db.execute({
    sql: `INSERT INTO notes (id, ciphertext, iv, burn_mode, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, ciphertext, iv, burnMode, now, expiresAt],
  })

  return { id, expiresAt }
}

// One statement. Either the row comes back or it does not, so two
// concurrent readers can never both receive the same note.
export async function burnNote(id, now = Date.now()) {
  const result = await db.execute({
    sql: 'DELETE FROM notes WHERE id = ? AND expires_at > ? RETURNING ciphertext, iv',
    args: [id, now],
  })

  const row = result.rows[0]
  if (row === undefined) return null

  await db.execute({ sql: "UPDATE stats SET value = value + 1 WHERE key = 'burned'", args: [] })

  return { ciphertext: String(row.ciphertext), iv: String(row.iv) }
}

// Non destructive. Only serves manual notes, so an auto note can never be
// read without being burned.
export async function peekNote(id, now = Date.now()) {
  const result = await db.execute({
    sql: `SELECT ciphertext, iv FROM notes
          WHERE id = ? AND expires_at > ? AND burn_mode = 'manual'`,
    args: [id, now],
  })

  const row = result.rows[0]
  if (row === undefined) return null

  return { ciphertext: String(row.ciphertext), iv: String(row.iv) }
}

export async function describeNote(id, now = Date.now()) {
  const result = await db.execute({
    sql: 'SELECT burn_mode, expires_at FROM notes WHERE id = ? AND expires_at > ?',
    args: [id, now],
  })

  const row = result.rows[0]
  if (row === undefined) return null

  return { burnMode: String(row.burn_mode), expiresAt: Number(row.expires_at) }
}

export async function readBurnedCount() {
  const result = await db.execute({ sql: "SELECT value FROM stats WHERE key = 'burned'", args: [] })
  const row = result.rows[0]
  return row === undefined ? 0 : Number(row.value)
}

export async function purgeExpired(now = Date.now()) {
  const result = await db.execute({
    sql: 'DELETE FROM notes WHERE expires_at <= ?',
    args: [now],
  })
  return result.rowsAffected ?? 0
}
