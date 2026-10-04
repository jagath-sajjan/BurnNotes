import { refreshStats } from './counter.js'
import { decodeKeyFragment, decryptNote } from './crypto.js'
import { byId, prefersReducedMotion, setMessage, setText, show } from './dom.js'
import { spawnEmbers } from './embers.js'
import { initMenus } from './menu.js'
import { isSoundEnabled, playBurnSound, toggleSound } from './sound.js'
import './taskbar.js'

// Long enough to actually read a long note, short enough that a shared screen
// or a shoulder surfer does not have forever.
const PLENTY_MIN_MS = 15000
const PLENTY_PER_CHAR_MS = 90
const PLENTY_MAX_MS = 90000

const PURGE_MS = 1200
const INFERNO_MS = 2600
const TICK_MS = 90
const CLOCK_TICK_MS = 200

const FLAME_FRAMES = [
  '    |    ',
  '   /|\\   ',
  '  / | \\  ',
  ' /  |  \\ ',
  ' \\  ^  / ',
  '  \\   /  ',
  '   \\_/   ',
  '    *    ',
]

const noteId = window.location.pathname.split('/').filter(Boolean)[1] ?? ''

// The key rides in the fragment. Link preview bots never send it, and without
// it we refuse before making any request at all.
const fragment = window.location.hash.slice(1)

const gate = byId('gate')
const gateError = byId('gate-error')
const stage = byId('stage')
const reveal = byId('reveal')
const flame = byId('flame')
const emberHost = byId('embers')
const noteText = byId('note-text')
const progressWrap = byId('progress')
const progressLabel = byId('progress-label')
const progressFill = byId('progress-fill')
const countdown = byId('countdown')
const countdownValue = byId('countdown-value')
const burnActions = byId('burn-actions')
const burnButton = byId('burn-button')
const burnedNotice = byId('burned-notice')
const readError = byId('read-error')
const goneNotice = byId('gone-notice')
const goneDetail = goneNotice.querySelector('.gone-detail')
const soundButton = byId('sound-toggle')
const doneButton = byId('done-button')
const phaseBox = byId('phase-box')

const state = {
  mode: 'auto',
  alive: false,
  expiresAt: 0,
  cancelled: false,
}

function paintSoundButton() {
  soundButton.textContent = isSoundEnabled() ? 'Sound: on' : 'Sound: off'
  soundButton.setAttribute('aria-pressed', String(isSoundEnabled()))
}

function clearFragment() {
  window.history.replaceState(null, '', window.location.pathname)
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function formatRemaining(milliseconds) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

function plentyFor(text) {
  const scaled = PLENTY_MIN_MS + text.length * PLENTY_PER_CHAR_MS
  return Math.min(PLENTY_MAX_MS, Math.max(PLENTY_MIN_MS, scaled))
}

function describeFailure(status) {
  if (status === 404) return 'This note has already been burned. It cannot be read twice.'
  if (status === 429) return 'Too many attempts from this network. Try again later.'
  return 'Could not reach the server. Check your connection and try again.'
}

async function requestJson(path, options) {
  const response = await fetch(path, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = new Error('request_failed')
    error.status = response.status
    throw error
  }
  return response.json()
}

function showGone(message) {
  state.alive = false
  show(gate, false)
  show(burnActions, false)
  show(reveal, false)
  show(phaseBox, false)
  show(burnedNotice, false)
  show(goneNotice, true)
  setMessage(goneDetail, message, 'warn')
  show(doneButton, true)
  doneButton.focus()
}

function showDecryptFailure() {
  show(gate, false)
  show(burnActions, false)
  show(reveal, true)
  show(phaseBox, false)
  show(readError, true)
  show(doneButton, true)
  doneButton.focus()
}

async function runPurge() {
  setText(progressLabel, 'DELETING SERVER COPY')
  const startedAt = performance.now()

  for (;;) {
    const ratio = Math.min(1, (performance.now() - startedAt) / PURGE_MS)
    progressFill.style.setProperty('--progress', `${Math.round(ratio * 100)}%`)
    if (ratio >= 1) return
    await sleep(TICK_MS)
  }
}

async function runInferno() {
  show(progressWrap, true)
  setText(progressLabel, 'INCINERATING')
  spawnEmbers(emberHost, 30)

  const startedAt = performance.now()
  let frame = 0

  for (;;) {
    const ratio = Math.min(1, (performance.now() - startedAt) / INFERNO_MS)
    progressFill.style.setProperty('--progress', `${Math.round((1 - ratio) * 100)}%`)
    if (ratio >= 1) break

    if (!prefersReducedMotion() && frame < FLAME_FRAMES.length * 4) {
      setText(flame, FLAME_FRAMES[frame % FLAME_FRAMES.length])
      frame += 1
    }
    await sleep(TICK_MS)
  }

  setText(flame, FLAME_FRAMES[FLAME_FRAMES.length - 1])
  spawnEmbers(emberHost, 12)
  await sleep(320)
}

function finishBurn() {
  state.alive = false
  show(burnActions, false)
  show(noteText, false)
  show(progressWrap, false)
  show(countdown, false)
  show(phaseBox, false)
  show(burnedNotice, true)
  show(doneButton, true)

  playBurnSound()
  refreshStats()
  doneButton.focus()
}

async function burnNow() {
  if (!state.alive || state.cancelled) return
  state.cancelled = true
  burnButton.disabled = true
  show(burnActions, false)
  show(countdown, false)

  try {
    await requestJson(`/api/notes/${encodeURIComponent(noteId)}/read`, { method: 'POST' })
  } catch (error) {
    showGone(describeFailure(error.status ?? 0))
    return
  }

  await runInferno()
  finishBurn()
}

async function openNote(path) {
  let payload
  try {
    payload = await requestJson(path, { method: 'POST' })
  } catch (error) {
    showGone(describeFailure(error.status ?? 0))
    return null
  }

  // The server copy is gone (auto) or the fragment is now spent (manual).
  // Take the key out of the address bar either way.
  clearFragment()

  try {
    return await decryptNote(payload.ciphertext, payload.iv, decodeKeyFragment(fragment))
  } catch {
    showDecryptFailure()
    return null
  }
}

function revealText(plaintext) {
  show(gate, false)
  show(burnActions, true)
  show(reveal, true)
  show(phaseBox, true)
  show(readError, false)
  show(goneNotice, false)
  show(burnedNotice, false)
  // textContent only, the note is never parsed as markup.
  setText(noteText, plaintext)
  show(noteText, true)
}

async function autoFlow() {
  setText(stage, 'Opening')

  const plaintext = await openNote(`/api/notes/${encodeURIComponent(noteId)}/read`)
  if (plaintext === null) return

  state.alive = true
  revealText(plaintext)

  await runPurge()

  setText(progressLabel, 'Auto burn armed')
  progressFill.style.setProperty('--progress', '100%')
  setText(stage, 'Reading')

  const windowMs = plentyFor(plaintext)
  const startedAt = performance.now()

  while (!state.cancelled) {
    const left = windowMs - (performance.now() - startedAt)
    if (left <= 0) break
    setText(countdownValue, `self destructs in ${formatRemaining(left)}`)
    show(countdown, true)
    await sleep(CLOCK_TICK_MS)
  }

  await burnNow()
}

async function manualFlow() {
  setText(stage, 'Opening')

  const plaintext = await openNote(`/api/notes/${encodeURIComponent(noteId)}/peek`)
  if (plaintext === null) return

  state.alive = true
  revealText(plaintext)

  setText(stage, 'Manual burn')
  setText(progressLabel, 'WAITING FOR THE READER')
  progressFill.style.setProperty('--progress', '100%')

  // The server destroys this note on its own at expiresAt, so closing the tab
  // still burns it.
  while (!state.cancelled && state.expiresAt - Date.now() > 0) {
    setText(countdownValue, `self destructs in ${formatRemaining(state.expiresAt - Date.now())}`)
    show(countdown, true)
    await sleep(1000)
  }

  if (!state.cancelled) {
    showGone('The note reached its expiry and was destroyed before anyone burned it.')
  }
}

async function start() {
  if (fragment === '') {
    setMessage(
      gateError,
      'This link is missing its key, so nothing was sent and nothing was destroyed. Ask for a fresh link.',
      'warn',
    )
    show(phaseBox, false)
    return
  }

  let described
  try {
    described = await requestJson(`/api/notes/${encodeURIComponent(noteId)}/expiry`)
  } catch (error) {
    showGone(describeFailure(error.status ?? 0))
    return
  }

  state.mode = described.burnMode === 'manual' ? 'manual' : 'auto'
  state.expiresAt = described.expiresAt ?? 0

  if (state.mode === 'manual') {
    await manualFlow()
  } else {
    await autoFlow()
  }
}

burnButton.addEventListener('click', () => burnNow())

soundButton.addEventListener('click', () => {
  toggleSound()
  paintSoundButton()
})

doneButton.addEventListener('click', () => window.location.replace('/'))

document.addEventListener('command', (event) => {
  const { command } = event.detail
  if (command === 'burn') burnNow()
  if (command === 'home') window.location.replace('/')
  if (command === 'sound') {
    toggleSound()
    paintSoundButton()
  }
})

initMenus(document)
paintSoundButton()
start()