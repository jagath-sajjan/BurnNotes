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

  // counter.js dispatches the first stats event, so there is nothing to paint
  // here on load.
  window.addEventListener('stats', (event) => {
    const node = document.getElementById('taskbar-burned')
    if (node !== null) node.textContent = String(event.detail.burned).padStart(6, '0')
  })
}

// Every page shows the taskbar, so it wires itself up on load.
initTaskbar()
