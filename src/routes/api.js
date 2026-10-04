import { Hono } from 'hono'
import { clientIp } from '../ip.js'
import { isValidNoteId } from '../ids.js'
import {
  burnNote,
  createNote,
  describeNote,
  peekNote,
  purgeExpired,
  readStats,
} from '../notes.js'
import { createRateLimiter } from '../rate-limit.js'
import { parseCreateBody } from '../validation.js'

const HOUR_MS = 60 * 60 * 1000

const createLimiter = createRateLimiter({ limit: 20, windowMs: HOUR_MS })
const readLimiter = createRateLimiter({ limit: 60, windowMs: HOUR_MS })

// Missing, expired, already read and not manual all produce this exact
// body, so a caller cannot tell them apart.
const NOT_FOUND = { error: 'not_found' }

function tooMany(ctx, verdict) {
  ctx.header('Retry-After', String(verdict.retryAfterSeconds))
  return ctx.json({ error: 'rate_limited' }, 429)
}

function noteIdFrom(ctx) {
  const { id } = ctx.req.param()
  return isValidNoteId(id) ? id : null
}

export function apiRoutes() {
  const app = new Hono()

  app.get('/api/health', (ctx) => ctx.json({ ok: true }))

  app.get('/api/stats', async (ctx) => ctx.json(await readStats()))

  app.post('/api/notes', async (ctx) => {
    const verdict = createLimiter(clientIp(ctx))
    if (!verdict.allowed) return tooMany(ctx, verdict)

    let body
    try {
      body = await ctx.req.json()
    } catch {
      return ctx.json({ error: 'invalid_request' }, 400)
    }

    const parsed = parseCreateBody(body)
    if (!parsed.ok) {
      if (parsed.reason === 'too_large') {
        return ctx.json({ error: 'note_too_large' }, 413)
      }
      return ctx.json({ error: 'invalid_request' }, 400)
    }

    await purgeExpired()

    const { id } = await createNote(parsed.value)
    return ctx.json({ id }, 201)
  })

  // Tells the reader which flow to run and how long the note survives.
  // Reveals no ciphertext and destroys nothing.
  app.get('/api/notes/:id/expiry', async (ctx) => {
    const verdict = readLimiter(clientIp(ctx))
    if (!verdict.allowed) return tooMany(ctx, verdict)

    const id = noteIdFrom(ctx)
    if (id === null) return ctx.json(NOT_FOUND, 404)

    const described = await describeNote(id)
    if (described === null) return ctx.json(NOT_FOUND, 404)

    return ctx.json(described)
  })

  app.post('/api/notes/:id/peek', async (ctx) => {
    const verdict = readLimiter(clientIp(ctx))
    if (!verdict.allowed) return tooMany(ctx, verdict)

    const id = noteIdFrom(ctx)
    if (id === null) return ctx.json(NOT_FOUND, 404)

    const peeked = await peekNote(id)
    if (peeked === null) return ctx.json(NOT_FOUND, 404)

    return ctx.json(peeked)
  })

  app.post('/api/notes/:id/read', async (ctx) => {
    const verdict = readLimiter(clientIp(ctx))
    if (!verdict.allowed) return tooMany(ctx, verdict)

    const id = noteIdFrom(ctx)
    if (id === null) return ctx.json(NOT_FOUND, 404)

    const burned = await burnNote(id)
    if (burned === null) return ctx.json(NOT_FOUND, 404)

    return ctx.json({ ciphertext: burned.ciphertext, iv: burned.iv, score: burned.score })
  })

  return app
}

// The limiters are per process. The test suite drives hundreds of requests
// through one client, so it needs a way to start each run with empty buckets.
export function resetApiRateLimiters() {
  createLimiter.clear()
  readLimiter.clear()
}
