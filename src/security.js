const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const BASE_HEADERS = {
  'Content-Security-Policy': CSP,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

const NO_STORE_PATHS = [/^\/api(\/|$)/, /^\/n(\/|$)/]

function wantsNoStore(pathname) {
  return NO_STORE_PATHS.some((pattern) => pattern.test(pathname))
}

export function securityHeaders() {
  return async function securityHeadersMiddleware(ctx, next) {
    await next()

    const headers = ctx.res.headers
    for (const [name, value] of Object.entries(BASE_HEADERS)) {
      headers.set(name, value)
    }
    headers.set('Cache-Control', wantsNoStore(ctx.req.path) ? 'no-store, max-age=0' : 'no-cache')

    if (ctx.error) {
      headers.set('Cache-Control', 'no-store, max-age=0')
    }
  }
}
