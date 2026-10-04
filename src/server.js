import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { config } from './config.js'
import { closeDatabase, initDatabase } from './db.js'
import { startSweep } from './sweep.js'

await initDatabase()

const app = createApp()
const sweep = startSweep()

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`BurnNotes listening on http://localhost:${info.port}`)
  console.log(`Database target: ${config.usesLocalFile ? 'local file' : 'remote libsql'}`)
  console.log('Press Ctrl+C to stop')
})

let closing = false

function shutdown(signal) {
  if (closing) return
  closing = true
  console.log(`${signal} received, shutting down`)
  clearInterval(sweep)
  server.close(() => {
    closeDatabase()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
