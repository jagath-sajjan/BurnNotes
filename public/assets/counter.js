import { setText } from './dom.js'

const DIGITS = 6

export async function refreshCounter() {
  const element = document.getElementById('burned')
  if (element === null) return

  try {
    const response = await fetch('/api/stats', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return
    const data = await response.json()
    if (typeof data.burned !== 'number') return
    setText(element, String(data.burned).padStart(DIGITS, '0'))
  } catch {
    // The counter is decoration. Leave the placeholder if the call fails.
  }
}

// Runs on import so a page can load this module directly.
refreshCounter()
