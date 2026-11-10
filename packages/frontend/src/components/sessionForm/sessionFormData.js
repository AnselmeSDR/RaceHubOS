import { FuelMode, SessionType } from '@racehubos/shared'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const DEFAULT_SLOTS = 6

/** The form's values for `session`, or those of a new practice session. */
export function initialFormData(session) {
  return {
    name: session?.name || '',
    type: session?.type || SessionType.PRACTICE,
    trackId: session?.trackId || '',
    championshipId: session?.championshipId || '',
    duration: session?.duration || null,
    maxLaps: session?.maxLaps || null,
    fuelMode: session?.fuelMode || FuelMode.OFF,
    drivers:
      session?.drivers?.map((sd) => ({
        driverId: sd.driverId,
        carId: sd.carId,
        controller: sd.controller || '',
        gridPos: sd.gridPos || null,
        position: sd.position || null,
      })) || [],
  }
}

/** How many controllers can race: the simulator's cars, else the Control Unit's, else six. */
export function availableSlotsOf(simulator) {
  if (simulator.isMockDevice) return simulator.cars?.length || DEFAULT_SLOTS
  return simulator.cuNumCars || DEFAULT_SLOTS
}

/** The first controller (as text, from "1") no line-up row uses yet; empty when all are taken. */
export function nextController(rows, slots) {
  const used = rows.map((d) => d.controller)
  return Array.from({ length: slots }, (_, i) => String(i + 1)).find((c) => !used.includes(c)) || ''
}

/** The line-up rows with a driver, a car and a controller. */
export const completeRows = (rows) => rows.filter((d) => d.driverId && d.carId && d.controller)

/** The tracks, championships, drivers and cars to choose from, and how many controllers can race. */
export async function loadSessionFormData() {
  const [tracks, championships, drivers, cars, simulator] = await Promise.all(
    ['tracks', 'championships', 'drivers', 'cars', 'simulator'].map((name) =>
      fetch(`${API_URL}/${name}`).then((r) => r.json())
    )
  )
  return {
    tracks: tracks.data || [],
    championships: championships.data || [],
    drivers: drivers.data || [],
    cars: cars.data || [],
    availableSlots: availableSlotsOf(simulator),
  }
}

/** Creates the session, or updates `session`; its saved state, or throws the server's error. */
export async function saveSession(session, body, fallbackError) {
  const response = await fetch(session ? `${API_URL}/sessions/${session.id}` : `${API_URL}/sessions`, {
    method: session ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || fallbackError)
  return data.data
}
