import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Hono } from 'hono'
import { PUBLIC_DIR } from '../paths.js'

const PAGE_FILES = {
  home: 'index.html',
  note: 'note.html',
  burned: 'burned.html',
}

async function renderPage(ctx, name, status = 200) {
  const html = await readFile(join(PUBLIC_DIR, PAGE_FILES[name]))
  return ctx.html(html, status)
}

export function pageRoutes() {
  const app = new Hono()

  app.get('/', (ctx) => renderPage(ctx, 'home'))

  app.get('/n/:id', (ctx) => renderPage(ctx, 'note'))

  return app
}

export function notFoundHandler() {
  return async (ctx) => {
    const { pathname } = new URL(ctx.req.url)
    if (pathname.startsWith('/n/')) {
      return renderPage(ctx, 'burned', 404)
    }
    return ctx.text('Not Found', 404)
  }
}
