import { refreshCounter } from './counter.js'
import {
  bytesToBase64Url,
  encodeKeyFragment,
  encryptNote,
  generateIv,
  generateNoteKey,
} from './crypto.js'
import { byId, setMessage, show } from './dom.js'
import { isSoundEnabled, toggleSound } from './sound.js'

const MAX_NOTE_CHARS = 16000

const form = byId('note-form')
const textarea = byId('note-body')
const expiry = byId('note-expiry')
const createButton = byId('create-button')
const formError = byId('form-error')
const result = byId('result')
const linkBox = byId('share-link')
const copyButton = byId('copy-button')
const newButton = byId('new-button')
const soundButton = byId('sound-toggle')

function describeError(status) {
  if (status === 429) return 'Too many notes from this network. Try again later.'
  if (status === 413) return 'That note is too large. Keep it under 16KB.'
  if (status === 400) return 'The server rejected that note.'
  return 'Could not reach the server. Check your connection.'
}

function paintSoundButton() {
  soundButton.textContent = isSoundEnabled() ? 'Sound: on' : 'Sound: off'
  soundButton.setAttribute('aria-pressed', String(isSoundEnabled()))
}

function resetToForm() {
  show(result, false)
  show(form, true)
  formError.textContent = ''
  textarea.value = ''
  textarea.focus()
}

async function copyLink() {
  const value = linkBox.value
  try {
    await navigator.clipboard.writeText(value)
    setMessage(formError, 'Link copied.', 'ok')
  } catch {
    linkBox.focus()
    linkBox.select()
    setMessage(formError, 'Copy blocked. The link is selected, press the key.', 'warn')
  }
}

async function createNote(event) {
  event.preventDefault()
  formError.textContent = ''

  const plaintext = textarea.value
  if (plaintext.trim() === '') {
    setMessage(formError, 'Write something first.', 'warn')
    textarea.focus()
    return
  }
  if (plaintext.length > MAX_NOTE_CHARS) {
    setMessage(formError, 'That note is too large. Keep it under 16KB.', 'warn')
    return
  }

  createButton.disabled = true
  createButton.textContent = 'Encrypting...'

  try {
    const rawKey = generateNoteKey()
    const iv = generateIv()
    const ciphertext = await encryptNote(plaintext, rawKey, iv)

    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        ciphertext,
        iv: bytesToBase64Url(iv),
        ttl: expiry.value,
      }),
    })

    if (!response.ok) {
      setMessage(formError, describeError(response.status), 'warn')
      return
    }

    const data = await response.json()
    const link = `${window.location.origin}/n/${data.id}#${encodeKeyFragment(rawKey)}`

    linkBox.value = link
    show(form, false)
    show(result, true)
    copyButton.focus()
    refreshCounter()
  } catch {
    setMessage(formError, 'Could not create the note. Try again.', 'warn')
  } finally {
    createButton.disabled = false
    createButton.textContent = 'Encrypt & Create Link'
  }
}

form.addEventListener('submit', createNote)
copyButton.addEventListener('click', copyLink)
newButton.addEventListener('click', resetToForm)

soundButton.addEventListener('click', () => {
  toggleSound()
  paintSoundButton()
})

paintSoundButton()
