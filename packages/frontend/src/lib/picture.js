// Uploaded pictures: framing in a square, background removal, size of the saved file.
// Pure functions on numbers and pixel arrays (RGBA, as a canvas gives them), tested without a canvas.

/** Side of the saved file: a square, never larger than this. */
export const MAX_SIDE = 512

/** Tolerance slider (0-100) to a distance between two RGB colours. */
export const toleranceDistance = (value) => value * 1.6

export const DEFAULT_TOLERANCE = 25

/**
 * Where an image of `width`×`height` falls in a square frame of side `side`, framed by
 * `{ scale, x, y }`: scale 1 covers the frame, offsets are in frame sides from the centre.
 */
export function placement(width, height, { scale, x, y }, side) {
  const ratio = width / height
  const w = Math.max(1, ratio) * scale * side
  const h = w / ratio
  return { left: side / 2 + x * side - w / 2, top: side / 2 + y * side - h / 2, width: w, height: h }
}

/** The scale that shows the whole image in the frame, the rest left to the background. */
export function containScale(width, height) {
  const ratio = width / height
  return Math.min(1, ratio) / Math.max(1, ratio)
}

/** Side of the saved file: the image's own pixels across the frame, at most MAX_SIDE (never upscaled). */
export function outputSide(width, height, scale) {
  const ratio = width / height
  const sourcePixels = width / (Math.max(1, ratio) * scale)
  return Math.max(1, Math.min(MAX_SIDE, Math.round(sourcePixels)))
}

/** Indices of the pixels on the edges of a `width`×`height` image. */
export function borderPixels(width, height) {
  const out = []
  for (let x = 0; x < width; x++) out.push(x, (height - 1) * width + x)
  for (let y = 1; y < height - 1; y++) out.push(y * width, y * width + width - 1)
  return out
}

/**
 * The colour most of the given pixels share, or null when they are not mostly one colour: a fifth of
 * them at least, transparent ones included (a picture already cut out has no background left to remove).
 */
export function dominantColour(pixels, indices) {
  const buckets = new Map()
  for (const p of indices) {
    const i = p * 4
    if (pixels[i + 3] < 128) continue
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4)
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n++
    bucket.r += pixels[i]
    bucket.g += pixels[i + 1]
    bucket.b += pixels[i + 2]
    buckets.set(key, bucket)
  }
  let best = null
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket
  if (!best || best.n < Math.max(8, indices.length * 0.2)) return null
  return [best.r / best.n, best.g / best.n, best.b / best.n]
}

/**
 * Makes transparent the pixels close to `colour` and connected to the seeds; the pixels of the
 * cut edge a little beyond the tolerance fade. Changes `pixels` in place, returns how many were erased.
 */
export function floodErase(pixels, width, height, seeds, colour, tolerance) {
  const distance = (p) => {
    const i = p * 4
    const r = pixels[i] - colour[0]
    const g = pixels[i + 1] - colour[1]
    const b = pixels[i + 2] - colour[2]
    return Math.sqrt(r * r + g * g + b * b)
  }
  const erased = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const visit = (p) => {
    if (erased[p] || pixels[p * 4 + 3] === 0 || distance(p) > tolerance) return
    erased[p] = 1
    queue[tail++] = p
  }
  for (const p of seeds) visit(p)
  while (head < tail) {
    const p = queue[head++]
    pixels[p * 4 + 3] = 0
    const x = p % width
    if (x > 0) visit(p - 1)
    if (x < width - 1) visit(p + 1)
    if (p >= width) visit(p - width)
    if (p < width * (height - 1)) visit(p + width)
  }
  const soft = 12 + tolerance * 0.5
  for (let p = 0; p < width * height; p++) {
    if (erased[p] || pixels[p * 4 + 3] === 0) continue
    const x = p % width
    const nextToCut =
      (x > 0 && erased[p - 1]) ||
      (x < width - 1 && erased[p + 1]) ||
      (p >= width && erased[p - width]) ||
      (p < width * (height - 1) && erased[p + width])
    if (!nextToCut) continue
    const d = distance(p)
    if (d < tolerance + soft) pixels[p * 4 + 3] = Math.round(pixels[p * 4 + 3] * Math.max(0, (d - tolerance) / soft))
  }
  return tail
}

/**
 * Removes a plain background: `{ type: 'edges' }` from the edges, in the colour most of them share;
 * `{ type: 'point', pixel }` the area of that pixel's colour. Returns the share of the image erased
 * (0-1), or null when there is nothing to remove (no plain edge, a pixel already transparent).
 */
export function removeBackground(pixels, width, height, action, tolerance) {
  if (action.type === 'edges') {
    const seeds = borderPixels(width, height)
    const colour = dominantColour(pixels, seeds)
    if (!colour) return null
    return floodErase(pixels, width, height, seeds, colour, tolerance) / (width * height)
  }
  const i = action.pixel * 4
  if (pixels[i + 3] === 0) return null
  const colour = [pixels[i], pixels[i + 1], pixels[i + 2]]
  return floodErase(pixels, width, height, [action.pixel], colour, tolerance) / (width * height)
}
