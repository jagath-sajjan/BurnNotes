import { Hono } from 'hono'

export function apiRoutes() {
  const app = new Hono()

  app.get('/api/health', (ctx) =>
    ctx.json({
      ok: true,
      database: 'ready',
    }),
  )

  return app
}
