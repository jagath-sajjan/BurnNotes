import { db } from './db.js'
import { newNoteId } from './ids.js'
import { base64UrlByteLength, GCM_TAG_BYTES } from './validation.js'

export const XP_BASE = 100
export const XP_BONUS_CAP = 400

export function scoreFor(ciphertext) {
  const chars = Math.max(0, base64UrlByteLength(ciphertext) - GCM_TAG_BYTES)
  const bonus = Math.min(XP_BONUS_CAP, Math.floor(chars / 5))
  return { chars, xp: XP_BASE + bonus }
}

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

  const ciphertext = String(row.ciphertext)
  const score = scoreFor(ciphertext)

  await db.execute({
    sql: `UPDATE stats
          SET value = CASE key
            WHEN 'burned' THEN value + 1
            WHEN 'xp' THEN value + ?
            WHEN 'chars' THEN value + ?
            ELSE value
          END
          WHERE key IN ('burned', 'xp', 'chars')`,
    args: [score.xp, score.chars],
  })

  return { ciphertext, iv: String(row.iv), score }
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

export async function readStats() {
  const result = await db.execute({ sql: 'SELECT key, value FROM stats', args: [] })
  const stats = { burned: 0, xp: 0, chars: 0 }
  for (const row of result.rows) {
    const key = String(row.key)
    if (Object.hasOwn(stats, key)) {
      stats[key] = Number(row.value)
    }
  }
  return stats
}

export async function purgeExpired(now = Date.now()) {
  const result = await db.execute({
    sql: 'DELETE FROM notes WHERE expires_at <= ?',
    args: [now],
  })
  return result.rowsAffected ?? 0
}
