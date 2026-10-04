import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { PUBLIC_DIR } from './paths.js'
import { apiRoutes } from './routes/api.js'
import { notFoundHandler, pageRoutes } from './routes/pages.js'
import { securityHeaders } from './security.js'

export function createApp() {
  const app = new Hono()

  app.use('*', securityHeaders())

  app.route('/', apiRoutes())
  app.route('/', pageRoutes())
  app.use('/assets/*', serveStatic({ root: PUBLIC_DIR }))

  app.notFound(notFoundHandler())

  return app
}
