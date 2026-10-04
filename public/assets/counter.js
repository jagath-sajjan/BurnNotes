import { formatXp, rankFor } from './xp.js'

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
    const xp = Number.isFinite(data.xp) ? data.xp : 0
    const chars = Number.isFinite(data.chars) ? data.chars : 0

    paintOdometer(burned)
    paintXp(xp, chars)
    window.dispatchEvent(new CustomEvent('stats', { detail: { burned, xp, chars } }))
  } catch {
    // Stats are decoration. Leave the placeholders if the call fails.
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

function paintXp(xp, chars) {
  const rank = rankFor(xp)

  const xpNode = document.getElementById('xp-value')
  if (xpNode !== null) xpNode.textContent = formatXp(xp)

  const levelNode = document.getElementById('xp-level')
  if (levelNode !== null) levelNode.textContent = `Level ${rank.level}`

  const rankNode = document.getElementById('xp-rank')
  if (rankNode !== null) rankNode.textContent = rank.name

  const barNode = document.getElementById('xp-bar')
  if (barNode !== null) barNode.style.setProperty('--progress', `${Math.round(rank.progress * 100)}%`)

  const charsNode = document.getElementById('xp-chars')
  if (charsNode !== null) charsNode.textContent = `${formatXp(chars)} chars`

  const nextNode = document.getElementById('xp-next')
  if (nextNode !== null) {
    nextNode.textContent =
      rank.next === null ? 'Top rank reached' : `${formatXp(rank.needed)} XP to ${rank.next.name}`
  }
}

// Runs on import so a page can load this module directly.
refreshStats()
