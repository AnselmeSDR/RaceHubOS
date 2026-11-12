import { containScale, MAX_SIDE, outputSide, placement, removeBackground } from './picture'

/** A width×height RGBA image from rows of one-letter colours: B black, W white, R red, . transparent. */
function image(rows) {
  const colours = { B: [0, 0, 0, 255], W: [255, 255, 255, 255], R: [220, 30, 30, 255], '.': [0, 0, 0, 0] }
  const height = rows.length
  const width = rows[0].length
  const pixels = new Uint8ClampedArray(width * height * 4)
  rows
    .join('')
    .split('')
    .forEach((c, p) => pixels.set(colours[c], p * 4))
  return { pixels, width, height }
}

/** The image back as rows: a transparent pixel is '.', a faded one '~', any other its letter. */
function rowsOf({ pixels, width, height }, before) {
  const out = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const alpha = pixels[p * 4 + 3]
      row += alpha === 0 ? '.' : alpha < 255 ? '~' : before[y][x]
    }
    out.push(row)
  }
  return out
}

const TOLERANCE = 40

describe('removeBackground from the edges', () => {
  test('erases the plain background around the subject, never the same colour enclosed in it', () => {
    const rows = ['BBBBBBB', 'BRRRRRB', 'BRBBBRB', 'BRRRRRB', 'BBBBBBB']
    const img = image(rows)
    const share = removeBackground(img.pixels, img.width, img.height, { type: 'edges' }, TOLERANCE)
    expect(rowsOf(img, rows)).toEqual(['.......', '.RRRRR.', '.RBBBR.', '.RRRRR.', '.......'])
    expect(share).toBeCloseTo(20 / 35)
  })

  test('edges of many colours are no plain background: nothing is touched', () => {
    const rows = ['BWRBWRB', 'WRRRRRW', 'RRBBBRR', 'BWRBWRB']
    const img = image(rows)
    expect(removeBackground(img.pixels, img.width, img.height, { type: 'edges' }, TOLERANCE)).toBeNull()
    expect(rowsOf(img, rows)).toEqual(rows)
  })

  test('a picture already cut out, touching the edges, keeps its subject whole', () => {
    // A car whose bumpers touch the sides: its 10 opaque edge pixels are the car, not a background
    const rows = [...Array(3).fill('.'.repeat(30)), ...Array(5).fill('R'.repeat(30)), ...Array(4).fill('.'.repeat(30))]
    const img = image(rows)
    expect(removeBackground(img.pixels, img.width, img.height, { type: 'edges' }, TOLERANCE)).toBeNull()
    expect(rowsOf(img, rows)).toEqual(rows)
  })

  test('the tolerance decides how far from the background colour a pixel still goes', () => {
    const rows = ['WWWW', 'WRRW', 'WWWW']
    const strict = image(rows)
    removeBackground(strict.pixels, 4, 3, { type: 'edges' }, TOLERANCE)
    expect(rowsOf(strict, rows)[1]).toBe('.RR.')
    // Wide enough to reach red from white: everything goes
    const loose = image(rows)
    removeBackground(loose.pixels, 4, 3, { type: 'edges' }, 400)
    expect(rowsOf(loose, rows)).toEqual(['....', '....', '....'])
  })
})

describe('removeBackground at a pixel (eraser)', () => {
  test('erases the area of that colour connected to it, and fades the edge just beyond the tolerance', () => {
    const rows = ['WWWW', 'WBBW', 'WBBW', 'WWWW']
    const img = image(rows)
    // A grey close to black, beside the black area: past the tolerance, within the fading band
    img.pixels.set([30, 30, 30, 255], 1 * 4)
    const share = removeBackground(img.pixels, 4, 4, { type: 'point', pixel: 5 }, TOLERANCE)
    expect(share).toBeCloseTo(4 / 16)
    expect(rowsOf(img, rows)).toEqual(['W~WW', 'W..W', 'W..W', 'WWWW'])
  })

  test('a pixel already transparent leaves nothing to remove', () => {
    const rows = ['..', 'BB']
    const img = image(rows)
    expect(removeBackground(img.pixels, 2, 2, { type: 'point', pixel: 0 }, TOLERANCE)).toBeNull()
    expect(rowsOf(img, rows)).toEqual(rows)
  })
})

describe('framing in the square', () => {
  test('at scale 1 the picture covers the frame; at containScale it fits whole, centred', () => {
    // A 1600×1000 car in a 100 px frame
    expect(placement(1600, 1000, { scale: 1, x: 0, y: 0 }, 100)).toEqual({ left: -30, top: 0, width: 160, height: 100 })
    const whole = placement(1600, 1000, { scale: containScale(1600, 1000), x: 0, y: 0 }, 100)
    expect(whole).toEqual({ left: 0, top: 18.75, width: 100, height: 62.5 })
  })

  test('offsets move the picture by frame sides', () => {
    expect(placement(500, 500, { scale: 0.5, x: 0.25, y: -0.25 }, 200)).toEqual({
      left: 100,
      top: 0,
      width: 100,
      height: 100,
    })
  })

  test(`the saved file is at most ${MAX_SIDE} px, and never upscales a small picture`, () => {
    expect(outputSide(2000, 2000, 1)).toBe(MAX_SIDE)
    expect(outputSide(300, 300, 1)).toBe(300)
    // Zoomed in on a small picture: fewer of its pixels across the frame
    expect(outputSide(300, 300, 2)).toBe(150)
    // A wide picture shown whole: its full width across the frame
    expect(outputSide(400, 200, containScale(400, 200))).toBe(400)
  })
})
