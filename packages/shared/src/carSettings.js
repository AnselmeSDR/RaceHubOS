/**
 * Car settings and the Control Unit scale.
 *
 * The CU knows 10 levels for speed, braking and fuel alike (manual 30352), and
 * carries the value in a 4-bit field — no fraction can be sent. Values are
 * stored 0-100 for historical reasons; everything shown to the user is the
 * level, so what is displayed is exactly what the CU receives.
 */

export const MAX_LEVEL = 10

/** Stored value (0-100) → CU level (1-10). */
export function toLevel(value) {
  return Math.max(1, Math.min(MAX_LEVEL, Math.round((value ?? 100) / 10)))
}

/** "7/10", ready to display. */
export function formatLevel(value) {
  return `${toLevel(value)}/${MAX_LEVEL}`
}

/** Share of the gauge to fill, in percent. */
export function levelPercent(value) {
  return (toLevel(value) / MAX_LEVEL) * 100
}
