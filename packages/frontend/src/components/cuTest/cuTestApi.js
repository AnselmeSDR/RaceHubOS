import { SessionType } from '@racehubos/shared'
import { API_URL } from '@/constants'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

const getJson = (path) => fetch(`${API_URL}${path}`).then((r) => r.json())

/** The latest free practice session, created when there is none, loaded into the sync service. */
export async function ensureTestSession() {
  const found = await getJson('/sessions?type=practice&championshipId=null')
  let session = null
  if (found.success && found.data?.length > 0) {
    session = [...found.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  } else {
    const created = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ type: SessionType.PRACTICE, name: 'Test Session' }),
    }).then((r) => r.json())
    if (created.success) session = created.data
  }
  // Loading a draft session resets the Control Unit
  if (session) await fetch(`${API_URL}/sync/load-session/${session.id}`, { method: 'POST' })
  return session
}

export async function loadDriversAndCars() {
  const [drivers, cars] = await Promise.all([getJson('/drivers'), getJson('/cars')])
  return { drivers: drivers.data || [], cars: cars.data || [] }
}

export const getBluetoothStatus = () => getJson('/bluetooth/status')

export const getBluetoothInfo = () => getJson('/bluetooth/info')

/** The answer of a Control Unit command: scan, start-race, esc, button/<id>… */
export function callBluetooth(endpoint, body = null) {
  const options = { method: 'POST', headers: JSON_HEADERS }
  if (body) options.body = JSON.stringify(body)
  return fetch(`${API_URL}/bluetooth${endpoint}`, options).then((r) => r.json())
}
