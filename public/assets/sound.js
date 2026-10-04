const STORAGE_KEY = 'burnnotes.sound'

let context = null
let enabled = readSetting()

function readSetting() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function writeSetting(value) {
  enabled = value
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
  } catch {
    // Private browsing. The toggle still works for this page view.
  }
}

function ensureContext() {
  if (context === null) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass === undefined) return null
    context = new AudioContextClass()
  }
  if (context.state === 'suspended') {
    context.resume().catch(() => {})
  }
  return context
}

export function isSoundEnabled() {
  return enabled
}

export function toggleSound() {
  writeSetting(!enabled)
  return enabled
}

export function playBurnSound() {
  if (!enabled) return
  const audio = ensureContext()
  if (audio === null) return

  const duration = 0.55
  const frameCount = Math.floor(audio.sampleRate * duration)
  const buffer = audio.createBuffer(1, frameCount, audio.sampleRate)
  const data = buffer.getChannelData(0)

  for (let index = 0; index < frameCount; index += 1) {
    const progress = index / frameCount
    const noise = Math.random() * 2 - 1
    const crackle = Math.random() < 0.02 ? (Math.random() * 2 - 1) * 0.8 : 0
    data[index] = (noise * 0.5 + crackle) * (1 - progress) * (1 - progress)
  }

  const source = audio.createBufferSource()
  source.buffer = buffer

  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1800, audio.currentTime)
  filter.frequency.exponentialRampToValueAtTime(160, audio.currentTime + duration)

  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.22, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(audio.destination)
  source.start()
  source.stop(audio.currentTime + duration)
}
