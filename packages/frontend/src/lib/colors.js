/**
 * Semantic color tokens for the racing app.
 * Colors are defined as CSS variables in index.css @theme.
 * This file maps them to Tailwind class combinations for convenience.
 */

// Session types
export const SESSION_COLORS = {
  practice: { bg: 'bg-session-practice/15', text: 'text-session-practice', solid: 'bg-session-practice' },
  qualif: { bg: 'bg-session-qualif/15', text: 'text-session-qualif', solid: 'bg-session-qualif' },
  race: { bg: 'bg-session-race/15', text: 'text-session-race', solid: 'bg-session-race' },
  balancing: { bg: 'bg-session-balancing/15', text: 'text-session-balancing', solid: 'bg-session-balancing' },
}

// Combined badge classes (bg tint + text color) for a session type.
// Falls back to the "practice" colors for unknown types.
export function sessionBadgeClass(type) {
  const c = SESSION_COLORS[type] || SESSION_COLORS.practice
  return `${c.bg} ${c.text}`
}

// Championship
export const CHAMPIONSHIP_COLOR = {
  solid: 'bg-championship',
  hover: 'hover:bg-championship/80',
  text: 'text-championship',
}

// Controllers (0-5)
export const CONTROLLER_COLORS = ['bg-ctrl-1', 'bg-ctrl-2', 'bg-ctrl-3', 'bg-ctrl-4', 'bg-ctrl-5', 'bg-ctrl-6']

// Podium positions
export const PODIUM_COLORS = {
  1: {
    bg: 'bg-championship',
    text: 'text-yellow-950',
    gradient: 'from-championship/40',
    border: 'border-championship',
  },
  2: { bg: 'bg-gray-300', text: 'text-gray-800', gradient: 'from-gray-400/30', border: 'border-gray-300' },
  3: { bg: 'bg-orange-400', text: 'text-orange-950', gradient: 'from-orange-500/30', border: 'border-orange-400' },
}

// Gap display
export const GAP_COLORS = {
  laps: 'text-gap-laps',
  timeClose: 'text-gap-close',
  timeMedium: 'text-gap-medium',
  timeFar: 'text-gap-far',
  leader: 'text-leader',
}

// Position delta arrows
export const DELTA_COLORS = {
  gained: 'text-delta-gained',
  lost: 'text-delta-lost',
}

// Session status
export const STATUS_COLORS = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground' },
  active: { bg: 'bg-session-race/15', text: 'text-session-race' },
  paused: { bg: 'bg-championship/15', text: 'text-championship' },
  finishing: { bg: 'bg-gap-laps/15', text: 'text-gap-laps' },
  finished: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// Status dots (header)
export const STATUS_DOTS = {
  active: 'bg-session-race animate-pulse',
  finishing: 'bg-gap-laps animate-pulse',
  finished: 'bg-muted-foreground/50',
}

// Fastest lap highlight
export const FASTEST_LAP_COLOR = 'text-fastest-lap'

// Colour of a car, track or driver profile when the record has none of its own
export const carColor = (car) => car.color || '#22C55E'
export const trackColor = (track) => track.color || '#9333EA'
export const driverColor = (driver) => driver.color || '#3B82F6'
export const divisionColor = (division) => division.color || '#6B7280'

const brightness = (hex) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!match) return null
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Dark text on a light colour, white on the others: a badge stays readable (SILVER, GOLD, PLATINIUM). */
export const textOn = (hex) => ((brightness(hex) ?? 0) > 160 ? '#1c1917' : '#fff')

/** The colour itself as text on white, unless too pale to read: then dark text. */
export const textOnWhite = (hex) => ((brightness(hex) ?? 0) > 200 ? '#1c1917' : hex)

/** The colour itself as text on the dark theme, unless too dark to read: then light text. */
export const textOnDark = (hex) => ((brightness(hex) ?? 255) < 80 ? '#e7e5e4' : hex)
