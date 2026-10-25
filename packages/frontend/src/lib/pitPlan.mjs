import { fuelTelemetry } from './fuelTelemetry.mjs'
export function pitPlan(
  entries,
  device,
  {
    pitPlan: enabled = true,
    pitPlaces = 2,
    leftRoute = '1× Weichentaste',
    rightRoute = '2× oder lange drücken',
    translate = (value, params = {}) => value.replace(/{{(\w+)}}/g, (_, key) => params[key] ?? ''),
  } = {},
  now = Date.now()
) {
  if (!enabled) return null
  pitPlaces = pitPlaces === 1 ? 1 : 2
  const readings = entries
    .filter((e) => Number.isInteger(e?.controller) && e.controller >= 0 && e.controller < 6)
    .map((e) => ({
      ...e,
      fuel: fuelTelemetry({
        connected: device.connected,
        socketConnected: device.socketConnected,
        status: device.cuStatus,
        receivedAt: device.lastStatusAt,
        now,
        controller: e.controller,
      }),
    }))
  if (!readings.length || readings.some((e) => !e.fuel.available || !e.fuel.enabled))
    return translate('Boxenplan: aktuelle Tankdaten und FUEL ON erforderlich')
  const inside = readings.filter((e) => e.fuel.inPit).length
  const next = readings
    .filter((e) => !e.fuel.inPit && e.fuel.raw <= 5)
    .sort((a, b) => a.fuel.raw - b.fuel.raw || a.controller - b.controller)
  const route = (i) =>
    pitPlaces === 2
      ? `${translate(i % 2 === 0 ? 'links' : 'rechts')} (${translate(i % 2 === 0 ? leftRoute : rightRoute)})`
      : translate('Tankplatz')
  return `${pitPlaces} ${translate('Tankplätze')} · ${inside} ${translate(inside === 1 ? 'Auto' : 'Autos')} ${translate('in Boxengasse')} · ${
    next.length
      ? translate('Nächste Tankgruppe (Plätze prüfen): ') +
        next
          .slice(0, pitPlaces)
          .map(
            (e, i) =>
              `${e.driver?.name || translate('Regler ') + (e.controller + 1)} (${e.fuel.raw}/15${e.fuel.raw === 0 ? translate(', SOFORT tanken') : ''}) → ${route(i)}`
          )
          .join(' + ') +
        (next.length > pitPlaces ? translate('; danach {{v0}} weitere', { v0: next.length - pitPlaces }) : '')
      : translate('Kein Tankstopp empfohlen')
  }`
}

export const trackExtrasDefaults = {
  sectors: true,
  pitPlan: true,
  pitPlaces: 2,
  leftRoute: '1× Weichentaste',
  rightRoute: '2× oder lange drücken',
}
export function normalizeTrackExtras(value) {
  const v = value && typeof value === 'object' ? value : {}
  return {
    sectors: v.sectors !== false,
    pitPlan: v.pitPlan !== false,
    pitPlaces: v.pitPlaces === 1 ? 1 : 2,
    leftRoute: typeof v.leftRoute === 'string' ? v.leftRoute.slice(0, 80) : trackExtrasDefaults.leftRoute,
    rightRoute: typeof v.rightRoute === 'string' ? v.rightRoute.slice(0, 80) : trackExtrasDefaults.rightRoute,
  }
}
