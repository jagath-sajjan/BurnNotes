import { refreshCounter } from './counter.js'
import { decodeKeyFragment, decryptNote } from './crypto.js'
import { byId, prefersReducedMotion, setMessage, setText, show } from './dom.js'
import { isSoundEnabled, playBurnSound, toggleSound } from './sound.js'

const FLAME_FRAMES = [
  '    |    ',
  '   /|\\   ',
  '  / | \\  ',
  ' /  |  \\ ',
  ' \\  ^  / ',
  '  \\   /  ',
  '   \\_/   ',
]

const BURN_MS = 1500
const FRAME_MS = 110

const gate = byId('gate')
const burnButton = byId('burn-button')
const gateError = byId('gate-error')
const reveal = byId('reveal')
const flame = byId('flame')
const noteText = byId('note-text')
const progress = byId('progress')
const progressFill = byId('progress-fill')
const progressLabel = byId('progress-label')
const burnedNotice = byId('burned-notice')
const readError = byId('read-error')
const soundButton = byId('sound-toggle')
const doneButton = byId('done-button')

const noteId = window.location.pathname.split('/').filter(Boolean)[1] ?? ''
const fragment = window.location.hash.slice(1)

function paintSoundButton() {
  soundButton.textContent = isSoundEnabled() ? 'Sound: on' : 'Sound: off'
  soundButton.setAttribute('aria-pressed', String(isSoundEnabled()))
}

function clearFragment() {
  window.history.replaceState(null, '', window.location.pathname)
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function describeReadFailure(status) {
  if (status === 404) return 'This note has been burned. It cannot be read twice.'
  if (status === 429) return 'Too many attempts from this network. Try again later.'
  return 'Could not reach the server. Check your connection.'
}

async function animateBurn() {
  if (prefersReducedMotion()) {
    progressFill.style.setProperty('--progress', '100%')
    setText(progressLabel, 'DELETED')
    return
  }

  const startedAt = performance.now()
  let frame = 0

  while (true) {
    const elapsed = performance.now() - startedAt
    const ratio = Math.min(1, elapsed / BURN_MS)
    progressFill.style.setProperty('--progress', `${Math.round(ratio * 100)}%`)

    if (ratio >= 1) break
    if (frame < FLAME_FRAMES.length * 3) {
      setText(flame, FLAME_FRAMES[frame % FLAME_FRAMES.length])
      frame += 1
    }
    await wait(FRAME_MS)
  }

  setText(flame, FLAME_FRAMES[FLAME_FRAMES.length - 1])
  setText(progressLabel, 'DELETED')
}

async function burnAndReveal() {
  burnButton.disabled = true
  gateError.textContent = ''

  if (fragment === '') {
    setMessage(gateError, 'This link is missing its key. Ask for a fresh link.', 'warn')
    burnButton.disabled = false
    return
  }

  let payload
  try {
    const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/read`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      setMessage(gateError, describeReadFailure(response.status), 'warn')
      burnButton.disabled = false
      return
    }

    payload = await response.json()
  } catch {
    setMessage(gateError, 'Could not reach the server. Check your connection.', 'warn')
    burnButton.disabled = false
    return
  }

  // The note is gone from the server now. The key leaves the address bar
  // next, whatever the decrypt result turns out to be.
  clearFragment()

  let plaintext
  try {
    plaintext = await decryptNote(payload.ciphertext, payload.iv, decodeKeyFragment(fragment))
  } catch {
    show(gate, false)
    show(reveal, true)
    show(burnedNotice, false)
    show(readError, true)
    show(doneButton, true)
    return
  }

  show(gate, false)
  show(reveal, true)
  show(burnedNotice, false)
  show(readError, false)

  // textContent only. Note text is never parsed as markup.
  setText(noteText, plaintext)
  setText(progressLabel, 'DELETING...')

  playBurnSound()
  await animateBurn()

  show(noteText, false)
  show(progress, false)
  show(burnedNotice, true)
  show(doneButton, true)
  refreshCounter()
  doneButton.focus()
}

burnButton.addEventListener('click', burnAndReveal)

doneButton.addEventListener('click', () => {
  window.location.replace('/')
})

soundButton.addEventListener('click', () => {
  toggleSound()
  paintSoundButton()
})

paintSoundButton()
