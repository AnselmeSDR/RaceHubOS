import { ChampionshipStatus } from '@racehubos/shared'
import { sendJson } from '@/lib/sessionApi'
import { sessionNames } from '@/lib/sessionNames'
import { limitsBody } from './sessionLimits'

// The answer's body; a refusal throws the server's error, or `fallbackError`
async function checked(response, fallbackError) {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || fallbackError)
  return body
}

export async function saveChampionshipInfo(id, { name, trackId }, fallbackError) {
  const response = await sendJson(`/api/championships/${id}`, 'PUT', { name: name.trim(), trackId: trackId || null })
  return (await checked(response, fallbackError)).data
}

/** The reopened championship, null when the server refuses. */
export async function reopenChampionship(id) {
  const response = await sendJson(`/api/championships/${id}`, 'PUT', { status: ChampionshipStatus.PLANNED })
  return response.ok ? (await response.json()).data : null
}

// The server reschedules the sessions of an automatic championship from its participants; `cars`
// gives a driver's car (null: none), else a newcomer runs their preferred one and the others keep theirs
export async function setChampionshipParticipants(id, driverIds, fallbackError, cars = {}) {
  const response = await sendJson(`/api/championships/${id}/participants`, 'PUT', {
    participants: driverIds.map((driverId) =>
      Object.hasOwn(cars, driverId) ? { driverId, carId: cars[driverId] } : { driverId }
    ),
    sessionNames: sessionNames(),
  })
  return checked(response, fallbackError)
}

/** The driver divisions and car categories the championship is run for. */
export async function saveChampionshipDivisions(id, divisionIds, fallbackError) {
  const response = await sendJson(`/api/championships/${id}`, 'PUT', { divisionIds })
  return (await checked(response, fallbackError)).data
}

// Unnamed, the session is named by the server in the interface language
export async function addChampionshipSession(id, { type, form, order }, fallbackError) {
  const response = await sendJson(`/api/championships/${id}/sessions`, 'POST', {
    type,
    name: form.name || undefined,
    ...limitsBody(form),
    order,
    sessionNames: sessionNames(),
  })
  return checked(response, fallbackError)
}

export const updateSessionLimits = (sessionId, form) =>
  sendJson(`/api/sessions/${sessionId}`, 'PUT', { name: form.name || null, ...limitsBody(form) })

// Two sessions trade their places in the running order
export const swapSessionOrder = (first, firstIndex, second, secondIndex) =>
  Promise.all([
    sendJson(`/api/sessions/${first.id}`, 'PUT', { order: secondIndex }),
    sendJson(`/api/sessions/${second.id}`, 'PUT', { order: firstIndex }),
  ])
