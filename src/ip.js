import { getConnInfo } from '@hono/node-server/conninfo'
import { config } from './config.js'

export function clientIp(ctx) {
  if (config.trustProxy) {
    const forwarded = ctx.req.header('x-forwarded-for')
    if (forwarded) {
      const first = forwarded.split(',')[0].trim()
      if (first !== '') return first
    }
  }

  try {
    const info = getConnInfo(ctx)
    if (info.remote && info.remote.address) return info.remote.address
  } catch {
    return 'unknown'
  }

  return 'unknown'
}
