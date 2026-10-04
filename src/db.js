import { createClient } from '@libsql/client'
import { config } from './config.js'

export const db = createClient({
  url: config.databaseUrl,
  authToken: config.authToken === '' ? undefined : config.authToken,
})

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS notes (
     id TEXT PRIMARY KEY,
     ciphertext TEXT NOT NULL,
     iv TEXT NOT NULL,
     burn_mode TEXT NOT NULL DEFAULT 'auto',
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS stats (
     key TEXT PRIMARY KEY,
     value INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS notes_expires_at_idx ON notes (expires_at)',
  `INSERT OR IGNORE INTO stats (key, value) VALUES ('burned', 0)`,
]

// Older databases predate the burn_mode column and CREATE TABLE IF NOT EXISTS
// will not add it. ALTER and swallow the duplicate, rather than asking
// PRAGMA table_info, which remote libSQL does not answer consistently.
async function ensureBurnModeColumn() {
  try {
    await db.execute("ALTER TABLE notes ADD COLUMN burn_mode TEXT NOT NULL DEFAULT 'auto'")
  } catch (error) {
    if (!/duplicate column name/i.test(String(error?.message))) throw error
  }
}

let ready = false

export function isDatabaseReady() {
  return ready
}

export async function initDatabase() {
  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await db.execute(statement)
    }
    await ensureBurnModeColumn()
    ready = true
  } catch (error) {
    ready = false
    throw new Error(
      `Database init failed. ${error.message}\n` +
        'For a remote libsql url, confirm TURSO_DATABASE_URL and TURSO_AUTH_TOKEN belong to the ' +
        'same database and that the token is current. Mint a new one with: ' +
        'turso db tokens create <db-name> --permission rw',
      { cause: error },
    )
  }
}

export async function closeDatabase() {
  db.close()
}
