// CU fuel is a 4-bit reading (0..15), not litres or a calibrated percentage.
export function fuelTelemetry({ connected, socketConnected, status, receivedAt, now, controller = 0 }) {
  const fresh = Boolean(
    connected && socketConnected && Number.isFinite(receivedAt) && now >= receivedAt && now - receivedAt <= 5000
  )
  const raw = status?.fuel?.[controller]
  const valid = Number.isInteger(raw) && raw >= 0 && raw <= 15
  const mode = Number.isInteger(status?.mode) ? status.mode : null
  const pitAvailable = fresh && mode !== null && Boolean(mode & 4)
  const enabled = fresh && mode !== null && Boolean(mode & 1)
  const real = enabled && Boolean(mode & 2)
  const available = fresh && valid && pitAvailable
  return {
    fresh,
    pitAvailable,
    enabled,
    real,
    available,
    raw: available ? raw : null,
    inPit: available && status?.pit?.[controller] === true,
    low: available && enabled && raw <= 3,
    ready: available && enabled && !real,
    mode: !fresh || mode === null ? 'unknown' : !enabled ? 'off' : real ? 'real' : 'on',
  }
}
