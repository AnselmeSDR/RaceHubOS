const API_URL = import.meta.env.VITE_API_URL || ''
const JSON_HEADERS = { 'Content-Type': 'application/json' }

const getJson = (path) => fetch(`${API_URL}${path}`).then((r) => r.json())

const post = (path, body) =>
  fetch(`${API_URL}${path}`, {
    method: 'POST',
    ...(body && { headers: JSON_HEADERS, body: JSON.stringify(body) }),
  }).then((r) => r.json())

/** The Control Unit's state before any event: stopped. */
export const IDLE_STATUS = { start: 8 }

/** The connection as the server knows it: connected, deviceType, deviceAddress, lastStatus. */
export const getStatus = () => getJson('/api/bluetooth/status')

/** The devices the app has connected to, kept by the server. */
export const getDevices = () => getJson('/api/devices')

/** The devices in reach, found within `timeout` ms; not kept. */
export const scanDevices = (timeout) => post('/api/bluetooth/scan', { timeout })

/** Connects to a device; the server keeps it on success. */
export const connectDevice = (address) => post('/api/bluetooth/connect', { address })

export const disconnectDevice = () => post('/api/bluetooth/disconnect')

export const deleteDevice = (deviceId) =>
  fetch(`${API_URL}/api/devices/${deviceId}`, { method: 'DELETE' }).then((r) => r.json())

/** A Control Unit command: start-race, esc, button/<id>. */
export const cuCommand = (command) => post(`/api/bluetooth/${command}`)
