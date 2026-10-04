import { existsSync, readFileSync } from 'node:fs'

const ENV_FILE = new URL('../.env', import.meta.url)

function parseEnvFile(text) {
  const parsed = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)
    if (key !== '') parsed[key] = value
  }
  return parsed
}

function loadEnvFile() {
  if (!existsSync(ENV_FILE)) return
  const parsed = parseEnvFile(readFileSync(ENV_FILE, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile()

const databaseUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:local.db'
const authToken = process.env.TURSO_AUTH_TOKEN || ''
const usesLocalFile = databaseUrl.startsWith('file:')

if (!usesLocalFile && authToken === '') {
  throw new Error(
    'TURSO_AUTH_TOKEN is required when DATABASE_URL or TURSO_DATABASE_URL is a remote libsql url',
  )
}

const port = Number.parseInt(process.env.PORT || '3000', 10)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

// Off by default. Turn on only when a platform you control sets
// x-forwarded-for and strips any client supplied value.
const trustProxy = process.env.TRUST_PROXY === 'true'

export const config = {
  databaseUrl,
  authToken,
  usesLocalFile,
  port,
  trustProxy,
  isProduction: process.env.NODE_ENV === 'production',
}
