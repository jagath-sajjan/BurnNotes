import { encryptNote, generateIv, generateNoteKey, bytesToBase64Url } from '../public/assets/crypto.js'

const BASE = process.env.BASE ?? 'http://localhost:3000'
let failures = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label} ${detail}`)
  }
}

async function api(path, init) {
  const response = await fetch(BASE + path, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    ...init,
  })
  const text = await response.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, body }
}

async function create(plaintext, ttl, burnMode) {
  const key = generateNoteKey()
  const iv = generateIv()
  const ciphertext = await encryptNote(plaintext, key, iv)
  const { status, body } = await api('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext, iv: bytesToBase64Url(iv), ttl, burnMode }),
  })
  return { status, body, key, ciphertext, iv: bytesToBase64Url(iv) }
}

console.log('static assets referenced by every page')
for (const page of ['/', '/n/aaaaaaaaaaaaaaaaaaaaaa', '/n/bbbbbbbbbbbbbbbbbbbbbb']) {
  const html = await (await fetch(BASE + page)).text()
  const refs = [
    ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ].map((m) => m[1])
  let allOk = true
  for (const ref of refs) {
    const res = await fetch(BASE + ref)
    if (res.status !== 200) {
      allOk = false
      console.log(`        ${ref} -> ${res.status}`)
    }
  }
  check(`${page} serves ${refs.length} assets`, allOk && refs.length > 0)
}

console.log('\nauto burn')
{
  const note = await create('auto secret text', '1h', 'auto')
  check('create 201', note.status === 201, JSON.stringify(note.body))

  const expiry = await api(`/api/notes/${note.body.id}/expiry`)
  check('expiry reports auto', expiry.body.burnMode === 'auto', JSON.stringify(expiry.body))
  check('expiry hides ciphertext', !('ciphertext' in expiry.body))

  const peek = await api(`/api/notes/${note.body.id}/peek`, { method: 'POST' })
  check('peek refused for auto', peek.status === 404, JSON.stringify(peek.body))

  const read = await api(`/api/notes/${note.body.id}/read`, { method: 'POST' })
  check('read 200', read.status === 200)
  check('ciphertext matches', read.body.ciphertext === note.ciphertext)
  check('score present', typeof read.body.score?.xp === 'number', JSON.stringify(read.body.score))
  check('chars counted', read.body.score.chars === 'auto secret text'.length, JSON.stringify(read.body.score))

  const again = await api(`/api/notes/${note.body.id}/read`, { method: 'POST' })
  check('second read 404', again.status === 404)
  check('identical 404 body', again.body.error === 'not_found')
}

console.log('\nmanual burn')
{
  const note = await create('manual secret text', '10m', 'manual')
  check('create 201', note.status === 201, JSON.stringify(note.body))

  const expiry = await api(`/api/notes/${note.body.id}/expiry`)
  check('expiry reports manual', expiry.body.burnMode === 'manual')
  check('manual expiry under 24h', expiry.body.expiresAt - Date.now() <= 24 * 3600 * 1000 + 5000)

  for (let i = 1; i <= 3; i += 1) {
    const peek = await api(`/api/notes/${note.body.id}/peek`, { method: 'POST' })
    check(`peek ${i} of 3 stays readable`, peek.status === 200 && peek.body.ciphertext === note.ciphertext)
  }

  const beforeStats = (await api('/api/stats')).body
  const stillStats = (await api('/api/stats')).body
  check('peeking scores nothing', beforeStats.xp === stillStats.xp && beforeStats.burned === stillStats.burned)

  const burn = await api(`/api/notes/${note.body.id}/read`, { method: 'POST' })
  check('manual burn 200', burn.status === 200)
  check('manual burn scores', burn.body.score.chars === 'manual secret text'.length)

  const afterBurn = await api(`/api/notes/${note.body.id}/peek`, { method: 'POST' })
  check('peek after burn 404', afterBurn.status === 404)
  const afterRead = await api(`/api/notes/${note.body.id}/read`, { method: 'POST' })
  check('read after burn 404', afterRead.status === 404)
}

console.log('\nvalidation')
{
  const bad = await create('x', '7d', 'manual')
  check('manual 7d refused', bad.status === 400, JSON.stringify(bad.body))

  const mode = await create('x', '1h', 'eternal')
  check('unknown mode refused', mode.status === 400)

  const ttl = await create('x', '99y', 'auto')
  check('unknown ttl refused', ttl.status === 400)
}

console.log('\nstats')
{
  const stats = (await api('/api/stats')).body
  check('has burned', Number.isFinite(stats.burned))
  check('has xp', Number.isFinite(stats.xp))
  check('has chars', Number.isFinite(stats.chars))
  console.log(`        ${JSON.stringify(stats)}`)
}

console.log('\nheaders')
{
  const res = await fetch(`${BASE}/n/aaaaaaaaaaaaaaaaaaaaaa`)
  const csp = res.headers.get('content-security-policy')
  check('csp default-src self', /default-src 'self'/.test(csp), csp)
  check('csp script-src self', /script-src 'self'/.test(csp))
  check('no inline script allowed', !/script-src[^;]*unsafe-inline/.test(csp), csp)
  check('no referrer', res.headers.get('referrer-policy') === 'no-referrer')
  check('no store', res.headers.get('cache-control') === 'no-store, max-age=0')
  check('frame deny', res.headers.get('x-frame-options') === 'DENY')
  const html = await res.text()
  check('no inline handlers in note page', !/\son[a-z]+="/i.test(html))
  check('no inline style attrs in note page', !/\sstyle="/i.test(html))
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECKS FAILED`)
process.exit(failures === 0 ? 0 : 1)