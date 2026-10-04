// Single Vercel function. Serves the HTML, the CSS, the JS and the api
// from one origin, so the frontend and the backend can never be split
// across two hosts.
//
// The database is initialised lazily and never at module scope. A throw at
// module scope crashes the cold start and Vercel answers with an opaque
// FUNCTION_INVOCATION_FAILED that says nothing about the cause. Here the
// function stays alive, reports the real reason, and retries.
import { getRequestListener } from '@hono/node-server'
import { createApp } from '../src/app.js'
import { initDatabase } from '../src/db.js'
import { assertServerEnv, diagnostic, isCredentialProblem, redact } from '../src/diagnostic.js'

const listener = getRequestListener(createApp().fetch)

// A function instance lives for many requests, so remember the outcome and
// back off between retries instead of hitting Turso on every keystroke.
const RETRY_MS = 5000
let state = 'pending'
let lastError = null
let lastAttempt = 0

async function ensureDatabase() {
  if (state === 'ready') return null

  const missing = assertServerEnv()
  if (missing !== null) {
    state = 'failed'
    lastError = new Error(missing)
    console.error('[burnnotes]', missing)
    return lastError
  }

  const now = Date.now()
  if (state === 'failed' && now - lastAttempt < RETRY_MS) return lastError
  lastAttempt = now

  try {
    await initDatabase()
    state = 'ready'
    lastError = null
    return null
  } catch (error) {
    state = 'failed'
    lastError = error
    const hint = isCredentialProblem(error) ? ' Check the database credentials.' : ''
    console.error(`[burnnotes] database init failed:${hint}`, redact(error?.message ?? error))
    return lastError
  }
}

function sendDiagnostic(res, error) {
  const body = `${diagnostic(error)}\n`
  res.statusCode = isCredentialProblem(error) ? 401 : 503
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.setHeader('cache-control', 'no-store, max-age=0')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(body)
}

export default async function handler(req, res) {
  const error = await ensureDatabase()
  if (error !== null) {
    sendDiagnostic(res, error)
    return
  }
  listener(req, res)
}