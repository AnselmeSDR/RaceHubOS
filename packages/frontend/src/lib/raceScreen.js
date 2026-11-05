import { SessionType, SessionStatus, RUNNING_SESSION_STATUSES } from '@racehubos/shared'
export const screenFields = {
  title: 'fields.title',
  track: 'fields.track',
  status: 'fields.status',
  elapsed: 'fields.elapsed',
  remaining: 'fields.remaining',
  limit: 'fields.limit',
  connection: 'fields.connection',
  lights: 'fields.lights',
  rows: 'fields.rows',
  position: 'fields.position',
  photo: 'fields.photo',
  name: 'fields.name',
  number: 'fields.number',
  team: 'fields.team',
  controller: 'fields.controller',
  car: 'fields.car',
  laps: 'fields.laps',
  best: 'fields.best',
  last: 'fields.last',
  total: 'fields.total',
  gap: 'fields.gap',
  fuel: 'fields.fuel',
  pit: 'fields.pit',
  dnf: 'fields.dnf',
}
export const globalFields = [
  'title',
  'track',
  'status',
  'elapsed',
  'remaining',
  'limit',
  'connection',
  'lights',
  'rows',
]
const box = (x, y, w, h, font = 30, visible = true) => ({
  x,
  y,
  w,
  h,
  font,
  visible,
})
export const defaultScreen = {
  version: 1,
  enabled: false,
  autoOpen: false,
  fullscreen: false,
  background: '#070e1b',
  textColor: '#f8fafc',
  rowBackground: '#111e32',
  widgets: {
    title: box(2, 2, 57, 7, 38),
    track: box(2, 10, 35, 5, 24),
    status: box(61, 2, 17, 7, 28),
    elapsed: box(79, 2, 19, 7, 32),
    remaining: box(61, 10, 18, 6, 26),
    limit: box(80, 10, 18, 6, 26),
    connection: box(2, 92, 96, 6, 22),
    lights: box(12, 30, 76, 35, 64),
    rows: box(2, 19, 96, 70),
    position: box(0, 8, 5, 80, 40),
    photo: box(5, 8, 7, 80),
    name: box(13, 5, 22, 40, 32),
    number: box(0, 5, 5, 35, 24, false),
    team: box(13, 50, 20, 30, 18, false),
    controller: box(13, 50, 7, 30, 18),
    car: box(21, 50, 20, 30, 18),
    laps: box(36, 5, 9, 80, 32),
    best: box(46, 5, 13, 80, 30),
    last: box(60, 5, 13, 80, 30),
    total: box(46, 5, 13, 80, 30, false),
    gap: box(74, 5, 12, 80, 24),
    fuel: box(87, 5, 12, 48, 24),
    pit: box(87, 57, 12, 33, 17),
    dnf: box(60, 55, 13, 30, 20, false),
  },
}
export function normalizeScreen(value) {
  const source = value && typeof value === 'object' ? value : {}
  const result = {
    version: 1,
    enabled: source.enabled === true,
    autoOpen: source.autoOpen === true,
    fullscreen: source.fullscreen === true,
    autoHeight: source.autoHeight !== false,
    widgets: {},
  }
  for (const id of ['background', 'textColor', 'rowBackground'])
    result[id] = validColor(source[id]) ? source[id] : defaultScreen[id]
  for (const [id, fallback] of Object.entries(defaultScreen.widgets)) {
    const input = source.widgets?.[id] || {}
    const number = (key, min, max) =>
      typeof input[key] === 'number' && Number.isFinite(input[key])
        ? Math.min(max, Math.max(min, input[key]))
        : fallback[key]
    const x = number('x', 0, 98)
    const y = number('y', 0, 98)
    result.widgets[id] = {
      x,
      y,
      w: Math.min(number('w', 2, 100), 100 - x),
      h: Math.min(number('h', 2, 100), 100 - y),
      font: number('font', 10, 100),
      visible: typeof input.visible === 'boolean' ? input.visible : fallback.visible,
      customColors: input.customColors === true,
      color: validColor(input.color) ? input.color : result.textColor,
      background: validColor(input.background) ? input.background : result.background,
    }
  }
  return result
}
function validColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}
export function normalizeScreens(value) {
  const source = value && typeof value === 'object' ? value : {}
  const profiles = Array.isArray(source.profiles)
    ? source.profiles
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
        .slice(0, 50)
        .map((p) => ({
          id: p.id.slice(0, 100),
          name: p.name.slice(0, 80),
          layout: normalizeScreen(p.layout),
        }))
    : []
  const unique = profiles.filter((p, index) => profiles.findIndex((other) => other.id === p.id) === index)
  if (!unique.length)
    unique.push({
      id: 'default',
      name: '',
      layout: normalizeScreen(null),
    })
  return {
    enabled: source.enabled === true,
    autoOpen: source.autoOpen === true,
    fullscreen: source.fullscreen === true,
    profiles: unique,
    activeProfile: unique.some((p) => p.id === source.activeProfile) ? source.activeProfile : unique[0].id,
  }
}
// Share one row template. Resize the surrounding vertical space only in the
// same column and scope; overlay lights and intentionally overlapping fields stay independent.
export function editScreen(value, id, patch) {
  const previous = normalizeScreen(value)
  const next = normalizeScreen({
    ...previous,
    widgets: {
      ...previous.widgets,
      [id]: {
        ...previous.widgets[id],
        ...patch,
      },
    },
  })
  if (!previous.autoHeight || !Number.isFinite(patch.h) || id === 'lights') return next
  const before = previous.widgets[id]
  const target = next.widgets[id]
  if (target.h === before.h) return next
  const peers = Object.entries(previous.widgets).filter(
    ([key, b]) =>
      key !== id &&
      key !== 'lights' &&
      b.visible &&
      globalFields.includes(key) === globalFields.includes(id) &&
      Math.min(before.x + before.w, b.x + b.w) - Math.max(before.x, b.x) > 0.1
  )
  const below = peers.filter(([, b]) => b.y >= before.y + before.h - 0.01)
  const above = peers.filter(([, b]) => b.y + b.h <= before.y + 0.01)
  if (below.length) {
    const oldEdge = before.y + before.h
    // Leave every neighbouring field at least its minimum usable percentage.
    const available = 100 - oldEdge
    const minScale = Math.max(...below.map(([, b]) => 2 / b.h))
    target.h = Math.max(2, Math.min(target.h, 100 - target.y - available * minScale))
    const edge = target.y + target.h
    const scale = (100 - edge) / available
    for (const [key, b] of below)
      next.widgets[key] = {
        ...next.widgets[key],
        y: edge + (b.y - oldEdge) * scale,
        h: b.h * scale,
      }
  } else if (above.length) {
    const edge = before.y + before.h
    const minScale = Math.max(...above.map(([, b]) => 2 / b.h))
    target.h = Math.max(2, Math.min(patch.h, edge - before.y * minScale))
    target.y = edge - target.h
    const scale = target.y / before.y
    for (const [key, b] of above)
      next.widgets[key] = {
        ...next.widgets[key],
        y: b.y * scale,
        h: b.h * scale,
      }
  }
  return normalizeScreen(next)
}
export function startLights(start, connected) {
  const visible = connected && Number.isInteger(start) && start >= 1 && start <= 7
  return {
    visible,
    count: !visible ? 0 : start === 1 || start === 7 ? 5 : start - 1,
    go: visible && start === 7,
    falseStart: false,
  }
}
export function shouldOpenScreen(previous, session, config) {
  return (
    config.enabled === true &&
    config.autoOpen &&
    session?.status === SessionStatus.ACTIVE &&
    (previous?.id !== session.id || !RUNNING_SESSION_STATUSES.includes(previous?.status))
  )
}
export function screenTime(ms, locale = 'de-DE') {
  if (!Number.isFinite(ms)) return '—'
  return (
    (Math.max(0, ms) / 1000).toLocaleString(locale, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + ' s'
  )
}

// The legacy race API uses numbers for both lap deficits and millisecond gaps.
export function screenGap(entry, leader, sessionType) {
  const gap = entry?.stats?.gap
  if (gap && typeof gap === 'object') return gap
  if (
    sessionType === SessionType.RACE &&
    Number.isFinite(entry?.stats?.laps) &&
    Number.isFinite(leader?.stats?.laps) &&
    entry.stats.laps < leader.stats.laps
  )
    return {
      type: 'laps',
      value: leader.stats.laps - entry.stats.laps,
    }
  return typeof gap === 'number' && Number.isFinite(gap)
    ? {
        type: 'time',
        value: gap,
      }
    : typeof gap === 'string'
      ? gap
      : null
}
