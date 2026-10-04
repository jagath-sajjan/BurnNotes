import { formatXp, rankFor } from './xp.js'

const CLOCK_MS = 15000

let started = false

function paintClock(node) {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  node.textContent = `${hours}:${minutes}`
}

export function initTaskbar() {
  if (started) return
  started = true

  const clock = document.getElementById('clock')
  if (clock !== null) {
    paintClock(clock)
    window.setInterval(() => paintClock(clock), CLOCK_MS)
  }

  window.addEventListener('stats', (event) => {
    const { xp, burned } = event.detail
    const rank = rankFor(xp)

    set('taskbar-xp', `${formatXp(xp)} XP`)
    set('taskbar-level', `LV ${rank.level}`)
    set('taskbar-rank', rank.name)
    set('taskbar-burned', String(burned).padStart(6, '0'))
  })

  // counter.js dispatches the first stats event, so nothing to paint here.
}

function set(id, value) {
  const node = document.getElementById(id)
  if (node !== null) node.textContent = value
}

// Every page shows the taskbar, so it wires itself up on load.
initTaskbar()
