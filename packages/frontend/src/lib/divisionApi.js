import { sendJson } from './sessionApi'

const API_URL = import.meta.env.VITE_API_URL || ''

// The division as the server answers it; a refusal throws its error, or `fallbackError`
async function divisionFrom(response, fallbackError) {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || fallbackError)
  return body.data
}

/** `memberId`, a driver or a car, joins the division; the division's page comes back. */
export async function addToDivision(divisionId, memberId, fallbackError) {
  return divisionFrom(await sendJson(`/api/divisions/${divisionId}/members`, 'POST', { memberId }), fallbackError)
}

/** `memberId` leaves the division; the division's page comes back. */
export async function removeFromDivision(divisionId, memberId, fallbackError) {
  const response = await fetch(`${API_URL}/api/divisions/${divisionId}/members/${memberId}`, { method: 'DELETE' })
  return divisionFrom(response, fallbackError)
}
