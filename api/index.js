// Single Vercel function. Serves the HTML, the CSS, the JS and the api
// from one origin, so the frontend and the backend can never be split
// across two hosts.
import { getRequestListener } from '@hono/node-server'
import { createApp } from '../src/app.js'
import { initDatabase } from '../src/db.js'

await initDatabase()

const listener = getRequestListener(createApp().fetch)

export default function handler(req, res) {
  listener(req, res)
}
