export function createRateLimiter({ limit, windowMs }) {
  const hits = new Map()

  function prune(now) {
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((time) => now - time < windowMs)
      if (kept.length === 0) {
        hits.delete(key)
      } else {
        hits.set(key, kept)
      }
    }
  }

  let sincePrune = 0

  function check(key, now = Date.now()) {
    sincePrune += 1
    if (sincePrune >= 500) {
      sincePrune = 0
      prune(now)
    }

    const stamps = (hits.get(key) ?? []).filter((time) => now - time < windowMs)

    if (stamps.length >= limit) {
      const oldest = stamps[0]
      hits.set(key, stamps)
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      }
    }

    stamps.push(now)
    hits.set(key, stamps)
    return { allowed: true, remaining: limit - stamps.length, retryAfterSeconds: 0 }
  }

  check.clear = () => hits.clear()

  return check
}
