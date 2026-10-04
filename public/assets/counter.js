const DIGITS = 6

export async function refreshStats() {
  try {
    const response = await fetch('/api/stats', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return
    const data = await response.json()

    const burned = Number.isFinite(data.burned) ? data.burned : 0
    paintOdometer(burned)
    window.dispatchEvent(new CustomEvent('stats', { detail: { burned } }))
  } catch {
    // Stats are decoration. Leave the placeholder if the call fails.
  }
}

function paintOdometer(burned) {
  for (const id of ['burned', 'taskbar-burned']) {
    const node = document.getElementById(id)
    if (node === null) continue
    const next = String(burned).padStart(DIGITS, '0')
    if (node.textContent === next) continue
    node.textContent = next
    node.classList.remove('tick')
    void node.offsetWidth
    node.classList.add('tick')
  }
}

// Runs on import so a page can load this module directly.
refreshStats()
