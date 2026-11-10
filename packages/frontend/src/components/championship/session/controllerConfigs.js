import { SessionType } from '@racehubos/shared'

export const CONTROLLERS = [0, 1, 2, 3, 4, 5]

/** What each of the six controllers is set to: `{ driverId, carId, gridPos }`, nulls when free. */
export function controllerConfigsOf(entries = []) {
  return Object.fromEntries(
    CONTROLLERS.map((controller) => {
      const entry = entries.find((d) => Number(d.controller) === controller)
      return [
        controller,
        { driverId: entry?.driverId || null, carId: entry?.carId || null, gridPos: entry?.gridPos || null },
      ]
    })
  )
}

/** The entries to save for the controllers set with a driver or a car. */
export function entriesPayload(configs) {
  return Object.entries(configs)
    .filter(([, c]) => c.driverId || c.carId)
    .map(([controller, c]) => ({
      controller: Number(controller),
      driverId: c.driverId || null,
      carId: c.carId || null,
      gridPos: c.gridPos || null,
    }))
}

/** The controllers with a driver and no car, or the other way round; balancing needs cars only. */
export function incompleteControllersOf(configs, sessionType) {
  if (sessionType === SessionType.BALANCING) return []
  return Object.entries(configs)
    .filter(([, c]) => !c.driverId !== !c.carId)
    .map(([controller, c]) => ({ controller: Number(controller), hasDriver: !!c.driverId }))
}

/** The items (drivers or cars) a controller may take: its own, and those set on no other controller. */
export function availableFor(items, configs, controller, field) {
  const currentId = configs[controller]?.[field]
  const used = Object.values(configs).map((c) => c[field])
  return items.filter((item) => item.id === currentId || !used.includes(item.id))
}
