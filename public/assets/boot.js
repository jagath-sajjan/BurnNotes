import { prefersReducedMotion } from './dom.js'

const STORAGE_KEY = 'burnnotes.booted'
const LINE_MS = 200
const HOLD_MS = 90

const LINES = [
  'BURNNOTES 1.0',
  'CHECKING CIPHER SUITE ......... AES-256-GCM',
  'MOUNTING KEY VAULT ............ OK',
  'WIPING CLIPBOARD .............. SKIPPED',
  'READY.',
]

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
    // Private browsing. The boot screen simply shows again.
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

  if (sessionSeen()) {
    overlay.remove()
    return
  }
  markSeen()

  const stream = document.getElementById('boot-log')
  const bar = document.getElementById('boot-bar')
  const quick = prefersReducedMotion()

  for (let index = 0; index < LINES.length; index += 1) {
    const line = document.createElement('p')
    line.className = 'boot-line'
    line.textContent = LINES[index]
    stream.append(line)
    bar.style.setProperty('--progress', `${Math.round(((index + 1) / LINES.length) * 100)}%`)

    if (quick) {
      await wait(40)
      continue
    }

    // Type the line out one character at a time. Every line gets the same
    // budget so the total time in here stays predictable.
    const text = LINES[index]
    const step = LINE_MS / text.length
    line.textContent = ''
    for (let cursor = 0; cursor < text.length; cursor += 1) {
      line.textContent = text.slice(0, cursor + 1)
      await wait(step)
    }
    await wait(HOLD_MS)
  }

  overlay.classList.add('leaving')
  await wait(quick ? 60 : 420)
  overlay.remove()
}
