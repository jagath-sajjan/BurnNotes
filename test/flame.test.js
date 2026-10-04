import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// The burn flame is drawn as ascii in the browser, so the only way to be sure it
// actually appears is to run the real routine here against stub elements. This
// caught a backslash being swallowed by a bad string escape, which quietly
// deleted half the diagonals and made the art look broken.

const SOURCE = readFileSync(new URL('../public/assets/read.js', import.meta.url), 'utf8')

const ART_WIDTH = 19
const ART_HEIGHT = 7

const STUBS = `
const paints = []
const nodes = new Map()
function byId(id) {
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      textContent: '',
      hidden: false,
      dataset: {},
      style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      appendChild() {},
      remove() {},
      setAttribute() {},
      removeAttribute() {},
      focus() {},
      click() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      children: [],
    })
  }
  return nodes.get(id)
}
const show = (element, visible) => {
  if (element) element.hidden = !visible
}
const setText = (element, value) => {
  if (!element) return
  element.textContent = String(value)
  if (element.id === 'flame') paints.push(String(value))
}
const spawnEmbers = () => 0
let REDUCED = false
const prefersReducedMotion = () => REDUCED
const window = {
  setTimeout,
  clearTimeout,
  location: { pathname: '/note/abc123', hash: '#abc123', search: '', href: '' },
}
const document = { addEventListener() {}, querySelectorAll: () => [], querySelector: () => null }
`

function loadBurn() {
  const consts = SOURCE.slice(
    SOURCE.indexOf('const PLENTY_MIN_MS'),
    SOURCE.indexOf('const FLAME_FRAMES')
  )
  const artStart = SOURCE.indexOf('const FLAME_FRAMES')
  const infernoEnd =
    SOURCE.indexOf('\n}\n', SOURCE.indexOf('async function runInferno')) + 3
  const chunk = consts + '\n' + SOURCE.slice(artStart, infernoEnd)

  const factory = new Function(
    STUBS +
      chunk +
      `
      return {
        run: async (reduced) => {
          REDUCED = reduced
          paints.length = 0
          await runInferno()
          return { paints: [...paints], still: STILL_FRAME }
        },
        frames: FLAME_FRAMES,
        still: STILL_FRAME,
        ink: countInk,
      }
    `
  )
  return factory()
}

function rows(paint) {
  return paint.split('\n')
}

describe('burn flame art', () => {
  const burn = loadBurn()

  it('has frames', () => {
    assert.ok(Array.isArray(burn.frames))
    assert.ok(burn.frames.length >= 4)
  })

  it('keeps every frame the same size so the layout does not jump', () => {
    for (const [index, frame] of burn.frames.entries()) {
      assert.equal(frame.length, ART_HEIGHT, `frame ${index} row count`)
      for (const [rowIndex, row] of frame.entries()) {
        assert.equal(row.length, ART_WIDTH, `frame ${index} row ${rowIndex} width`)
      }
    }
  })

  it('never renders an empty or blank frame', () => {
    for (const [index, frame] of burn.frames.entries()) {
      assert.notEqual(frame.join('').trim(), '', `frame ${index} is blank`)
    }
  })

  it('escapes every backslash in the art source', () => {
    const start = SOURCE.indexOf('const FLAME_FRAMES')
    const block = SOURCE.slice(start, SOURCE.indexOf('\n]', start))
    const literals = [...block.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) => match[1])
    assert.ok(literals.length > 0, 'no art literals found')

    for (const [index, literal] of literals.entries()) {
      // A lone backslash is not a valid js escape. It silently deletes itself,
      // which is how half the diagonals disappeared once already.
      assert.ok(
        !/(^|[^\\])\\(?!\\)/.test(literal),
        `art row ${index} has an unescaped backslash: ${JSON.stringify(literal)}`
      )
    }

    const art = burn.frames.flat().join('\n')
    assert.ok(art.includes('/|\\'), 'expected the inner diagonals of the flame')
    assert.ok(art.includes('___\\'), 'expected the flame base with its right edge')
    assert.ok(
      (art.match(/\\/g) || []).length >= 10,
      'expected the diagonals to survive as backslashes'
    )
  })

  it('holds a full flame for reduced motion', () => {
    const still = burn.frames[burn.still]
    assert.ok(still.join('').includes('___'))
    assert.ok(burn.ink(still) > burn.ink(burn.frames[0]), 'still frame should be the fullest')
  })
})

describe('runInferno', () => {
  const burn = loadBurn()

  it('paints a flame for the whole burn', async () => {
    const { paints } = await burn.run(false)
    assert.ok(paints.length > 0, 'nothing was painted')
    assert.ok(paints.every((paint) => paint.trim() !== ''), 'a blank frame was painted')
    assert.ok(
      paints.every((paint) => rows(paint).length === ART_HEIGHT),
      'a frame had the wrong height'
    )
    assert.ok(
      paints.every((paint) => rows(paint).every((row) => row.length === ART_WIDTH)),
      'a frame had a ragged width'
    )
  })

  it('animates several distinct frames when motion is allowed', async () => {
    const { paints } = await burn.run(false)
    assert.ok(new Set(paints).size >= 4, 'expected the flame to change')
    assert.ok(
      paints.some((paint) => paint.includes('___')),
      'expected a full flame body at some point'
    )
  })

  it('shows one still frame when motion is reduced', async () => {
    const { paints } = await burn.run(true)
    assert.equal(paints.length, 1)
    assert.equal(paints[0].trim(), burn.frames[burn.still].join('\n').trim())
    assert.ok(paints[0].includes('___'))
  })
})