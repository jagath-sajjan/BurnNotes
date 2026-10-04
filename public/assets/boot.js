import { prefersReducedMotion } from './dom.js'

const STORAGE_KEY = 'burnnotes.booted'
const SPLASH_MS = 2600
const FADE_MS = 420

const MARQUEE =
  'BurnNotes ' +
  'seals the text in your browser ' +
  'sends only locked bytes to the server ' +
  'destroys the row on first read ' +
  'the key never leaves the link ' +
  'BurnNotes '

function sessionSeen() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Private browsing. The splash simply shows again.
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function runBoot() {
  const overlay = document.getElementById('boot')
  if (overlay === null) return

  if (sessionSeen() || prefersReducedMotion()) {
    overlay.remove()
    return
  }
  markSeen()

  const track = overlay.querySelector('.boot-marquee-text')
  if (track !== null) {
    // Two copies so the loop has no visible seam.
    track.textContent = `${MARQUEE}${MARQUEE}`
  }

  await wait(SPLASH_MS)

  overlay.classList.add('leaving')
  await wait(FADE_MS)
  overlay.remove()
}