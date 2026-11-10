import { SessionStatus, SessionType } from '@racehubos/shared'
import { getData, sendJson } from './sessionApi'

const API_URL = import.meta.env.VITE_API_URL || ''
const STANDING_TYPES = [SessionType.PRACTICE, SessionType.QUALIF, SessionType.RACE]

export const getChampionship = (id) => getData(`/api/championships/${id}`)

export const getChampionshipSessions = (id) => getData(`/api/sessions?championshipId=${id}`)

/** An automatic championship's qualifying groups, merged ranking and race groups; null when unreadable. */
export const getBracket = (id) => getData(`/api/championships/${id}/bracket`)

/** The practice, qualifying and race standings of a championship, null when they can't be read. */
export async function getStandings(id) {
  try {
    const bodies = await Promise.all(
      STANDING_TYPES.map((type) =>
        fetch(`${API_URL}/api/championships/${id}/standings?type=${type}`).then((r) => r.json())
      )
    )
    return Object.fromEntries(STANDING_TYPES.map((type, i) => [type, bodies[i].standings || []]))
  } catch (err) {
    console.error('Failed to load the standings:', err)
    return null
  }
}

/** Marks a championship finished; its new state, or null when that failed. */
export async function finishChampionship(id) {
  try {
    const res = await sendJson(`/api/championships/${id}`, 'PUT', { status: SessionStatus.FINISHED })
    return res.ok ? (await res.json()).data : null
  } catch (err) {
    console.error('Error finishing championship:', err)
    return null
  }
}

/** Deletes a championship, which hides its sessions and laps too (cascade). */
export const deleteChampionship = (id) => fetch(`${API_URL}/api/championships/${id}`, { method: 'DELETE' })
