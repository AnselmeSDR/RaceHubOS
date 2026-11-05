import { fuelTelemetry } from './fuelTelemetry.js'
export const pitAdviceDefaults = Object.freeze({ enabled: false, places: 1 })
export function normalizePitAdvice(value) {
  return { enabled: value?.enabled === true, places: value?.places === 2 ? 2 : 1 }
}
/** Advisory ordering only. CU data never proves individual left/right bay occupancy. */
export function planPitAdvice(entries, device, config, now = Date.now()) {
  const options = normalizePitAdvice(config)
  if (!options.enabled) return null
  const cars = entries.filter(
    (entry) => Number.isInteger(entry?.controller) && entry.controller >= 0 && entry.controller < 6
  )
  const unique = new Set(cars.map((entry) => entry.controller))
  if (!cars.length || unique.size !== cars.length)
    return { status: 'unavailable', places: options.places, group: [], remaining: 0, inside: null }
  const readings = cars.map((entry) => ({
    entry,
    fuel: fuelTelemetry({
      connected: device.connected,
      socketConnected: device.socketConnected,
      status: device.cuStatus,
      receivedAt: device.lastStatusAt,
      now,
      controller: entry.controller,
    }),
  }))
  if (readings.some((item) => !item.fuel.available || !item.fuel.enabled))
    return { status: 'unavailable', places: options.places, group: [], remaining: 0, inside: null }
  const queue = readings
    .filter((item) => !item.fuel.inPit && item.fuel.raw <= 5)
    .sort((a, b) => a.fuel.raw - b.fuel.raw || a.entry.controller - b.entry.controller)
  return {
    status: queue.length ? 'recommended' : 'none',
    places: options.places,
    inside: readings.filter((item) => item.fuel.inPit).length,
    group: queue.slice(0, options.places).map(({ entry, fuel }) => ({
      controller: entry.controller,
      name: entry.driver?.name || '',
      fuel: fuel.raw,
      urgent: fuel.raw === 0,
    })),
    remaining: Math.max(0, queue.length - options.places),
  }
}
