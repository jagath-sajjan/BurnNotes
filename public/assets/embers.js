import { prefersReducedMotion } from './dom.js'

const GLYPH_SOURCE = '.:*!i1=+^'

export function spawnEmbers(host, count = 26) {
  if (host === null || prefersReducedMotion()) return

  for (let index = 0; index < count; index += 1) {
    const ember = document.createElement('span')
    ember.className = 'ember'

    const drift = (Math.random() * 120 - 60).toFixed(0)
    const rise = (60 + Math.random() * 120).toFixed(0)
    const size = (3 + Math.random() * 5).toFixed(1)
    const delay = (Math.random() * 700).toFixed(0)
    const glyph = GLYPH_SOURCE[Math.floor(Math.random() * GLYPH_SOURCE.length)]

    ember.textContent = glyph
    ember.style.setProperty('--drift', `${drift}px`)
    ember.style.setProperty('--rise', `${rise}px`)
    ember.style.setProperty('--size', `${size}px`)
    ember.style.setProperty('--delay', `${delay}ms`)

    host.append(ember)

    window.setTimeout(() => {
      ember.remove()
    }, 2600 + delay)
  }
}
