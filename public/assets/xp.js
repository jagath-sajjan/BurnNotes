export const RANKS = [
  { at: 0, name: 'Newcomer' },
  { at: 300, name: 'Spark' },
  { at: 900, name: 'Kindling' },
  { at: 2000, name: 'Torchbearer' },
  { at: 4500, name: 'Ash Miner' },
  { at: 9000, name: 'Firewall' },
  { at: 18000, name: 'Cipher Breaker' },
  { at: 36000, name: 'Flashpoint' },
]

export function rankFor(xp) {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0

  let index = 0
  for (let cursor = 0; cursor < RANKS.length; cursor += 1) {
    if (safeXp >= RANKS[cursor].at) index = cursor
  }

  const current = RANKS[index]
  const next = RANKS[index + 1] ?? null
  const span = next === null ? 1 : Math.max(1, next.at - current.at)
  const into = safeXp - current.at

  return {
    level: index + 1,
    name: current.name,
    next,
    into,
    needed: next === null ? 0 : next.at - safeXp,
    progress: next === null ? 1 : Math.min(1, into / span),
  }
}

export function formatXp(xp) {
  return Math.floor(xp).toLocaleString('en-US')
}
