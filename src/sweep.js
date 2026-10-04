import { purgeExpired } from './notes.js'

export const SWEEP_INTERVAL_MS = 5 * 60 * 1000

export function startSweep(intervalMs = SWEEP_INTERVAL_MS) {
  const timer = setInterval(() => {
    purgeExpired().catch((error) => {
      console.error('note sweep failed:', error.message)
    })
  }, intervalMs)
  timer.unref()
  return timer
}
