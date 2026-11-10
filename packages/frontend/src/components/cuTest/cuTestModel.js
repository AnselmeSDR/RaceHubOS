import { CONTROLLER_COLORS, MODE_FLAGS } from '@/constants'

export const LOG_TYPES = ['success', 'error', 'lap', 'status', 'info']

const LOG_COLORS = {
  success: 'text-green-400',
  error: 'text-red-400',
  lap: 'text-yellow-400',
  status: 'text-blue-400',
}

const SOURCE_BADGES = {
  APP: 'bg-gray-600',
  SOCKET: 'bg-purple-600',
  LAP: 'bg-yellow-600',
  RACE: 'bg-green-600',
  BLE: 'bg-blue-600',
  SESSION: 'bg-orange-600',
  PHASE: 'bg-pink-600',
  POS: 'bg-cyan-600',
  UNKNOWN: 'bg-red-600',
}

export const logColor = (type) => LOG_COLORS[type] || 'text-gray-300'
export const sourceBadge = (source) => SOURCE_BADGES[source] || 'bg-gray-600'

/** A log line: when, its kind (one of LOG_TYPES), who sent it, what it says, and the data behind it. */
export const logEntry = (type, source, message, data = null) => ({
  timestamp: new Date().toISOString(),
  type,
  source,
  message,
  data,
})

/** The logs of one kind, or from one source (its name in lower case), all with 'all'. */
export const filterLogs = (logs, filter) =>
  filter === 'all' ? logs : logs.filter((log) => log.type === filter || log.source.toLowerCase() === filter)

/** The logs grouped by kind, in their order. */
export const groupLogs = (logs) =>
  logs.reduce((groups, log) => {
    ;(groups[log.type] ||= []).push(log)
    return groups
  }, {})

export const formatSeconds = (ms) => (ms ? `${(ms / 1000).toFixed(3)}s` : '-')

/** The drivers on controllers 1 to 8 with the car of the same rank, when nothing is configured yet. */
export function autoAssignControllers(drivers, cars, config) {
  if (Object.keys(config).length > 0) return config
  const assigned = {}
  drivers.slice(0, 8).forEach((driver, index) => {
    assigned[index + 1] = { driverId: driver.id, carId: cars[index]?.id || null }
  })
  return assigned
}

/** The test leaderboard after a lap, keyed by controller. */
export function recordLap(leaderboard, lapData, now = Date.now()) {
  const key = lapData.controller || lapData.carId || 'unknown'
  const existing = leaderboard[key] || { laps: 0, bestLap: null, lastLap: null, totalTime: 0 }
  const lapTime = lapData.lapTime || lapData.time
  return {
    ...leaderboard,
    [key]: {
      ...existing,
      controller: key,
      laps: lapData.lapNumber || existing.laps + 1,
      lastLap: lapTime,
      bestLap: existing.bestLap === null ? lapTime : Math.min(existing.bestLap, lapTime),
      totalTime: existing.totalTime + lapTime,
      lastUpdate: now,
    },
  }
}

/** Most laps first, then best lap; a car without a lap time last. */
export const sortTestLeaderboard = (leaderboard) =>
  Object.values(leaderboard).sort((a, b) => {
    if (b.laps !== a.laps) return b.laps - a.laps
    if (!a.bestLap) return 1
    if (!b.bestLap) return -1
    return a.bestLap - b.bestLap
  })

/** Who drives what on a controller, as configured, with the controller's color by default. */
export function controllerInfo(controller, config, drivers, cars, t) {
  const assigned = config[controller] || {}
  const driver = assigned.driverId ? drivers.find((d) => d.id === assigned.driverId) : null
  const car = assigned.carId ? cars.find((c) => c.id === assigned.carId) : null
  return {
    driverName: driver?.name || assigned.driverName || t('leaderboard.defaultDriver', { number: controller }),
    carName: car
      ? `${car.brand} ${car.model}`
      : assigned.carName || t('leaderboard.defaultCar', { number: controller }),
    color: car?.color || driver?.color || assigned.color || CONTROLLER_COLORS[controller] || '#888',
  }
}

/** The start light state the Control Unit reports, as a text and a color. */
export function raceStateOf(cuStatus, t) {
  if (!cuStatus) return { text: t('raceState.unknown'), color: 'gray' }
  const { start } = cuStatus
  if (start === 0) return { text: t('raceState.racing'), color: 'green' }
  if (start >= 1 && start <= 5) return { text: t('raceState.lights', { count: start }), color: 'yellow' }
  if (start === 6) return { text: t('raceState.falseStart'), color: 'red' }
  if (start === 7) return { text: t('raceState.go'), color: 'green' }
  if (start >= 8) return { text: t('raceState.stopped'), color: 'red' }
  return { text: t('raceState.state', { state: start }), color: 'gray' }
}

const MODES = [
  [MODE_FLAGS.FUEL, 'modes.fuel'],
  [MODE_FLAGS.REAL, 'modes.real'],
  [MODE_FLAGS.PIT_LANE, 'modes.pitLane'],
  [MODE_FLAGS.LAP_COUNTER, 'modes.lapCounter'],
]

/** The modes the Control Unit has on. */
export const modesOf = (cuStatus, t) =>
  cuStatus ? MODES.filter(([flag]) => cuStatus.mode & flag).map(([, key]) => t(key)) : []

/** What the Control Unit's info tells about itself, one line each. */
export function cuInfoLines({ version, ble }) {
  const lines = [`CU Version: ${version}`]
  if (!ble) return lines
  lines.push(`BLE Name: ${ble.name} | Addr: ${ble.address} | UUID: ${ble.uuid}`)
  if (ble.rssi) lines.push(`RSSI: ${ble.rssi}dBm`)
  if (ble.manufacturerData) lines.push(`Manufacturer: ${ble.manufacturerData}`)
  if (ble.services?.length) lines.push(`Services: ${ble.services.join(', ')}`)
  return lines
}
