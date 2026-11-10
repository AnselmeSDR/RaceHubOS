import { Eye, Settings, Trophy, Users } from 'lucide-react'
import { ChampionshipMode } from '@racehubos/shared'
import { sessionNames } from '@/lib/sessionNames'

const API_URL = import.meta.env.VITE_API_URL || ''

export const WIZARD_STEPS = [
  { key: 'info', labelKey: 'wizard.steps.info', icon: Trophy },
  { key: 'participants', labelKey: 'wizard.steps.participants', icon: Users },
  { key: 'config', labelKey: 'wizard.steps.config', icon: Settings },
  { key: 'preview', labelKey: 'wizard.steps.preview', icon: Eye },
]

// Each session kind is limited by a duration (minutes), a number of laps, or both
export const DEFAULT_WIZARD_CONFIG = {
  driversPerQualif: 4,
  driversPerRace: 6,
  qualif: { useTime: true, duration: 5, useLaps: false, laps: 0 },
  race: { useTime: true, duration: 10, useLaps: false, laps: 0 },
}

export const groupCount = (participants, perGroup) => Math.ceil(participants / perGroup) || 0

// An empty row always follows the last filled one
export function withEmptyRow(participants) {
  const lastRow = participants.at(-1)
  return !lastRow || lastRow.driverId ? [...participants, { driverId: null, driver: null }] : participants
}

// Qualifying groups are dealt like cards
export function qualifGroups(participants, perGroup) {
  const count = groupCount(participants.length, perGroup)
  const groups = Array.from({ length: count }, () => [])
  participants.forEach((p, i) => groups[i % count].push(p))
  return groups
}

// Races share the global ranking in balanced slices: the first races take the extra drivers
export function raceGroups(participants, perGroup) {
  const count = groupCount(participants, perGroup)
  const baseSize = Math.floor(participants / count)
  const extra = participants % count
  const groups = []
  let offset = 0
  for (let g = 0; g < count; g++) {
    const size = baseSize + (g < extra ? 1 : 0)
    groups.push({ start: offset + 1, end: offset + size, count: size })
    offset += size
  }
  return groups
}

export const hasLimit = (limits) => limits.useTime || limits.useLaps

export const isConfigValid = (config) => hasLimit(config.qualif) && hasLimit(config.race)

const maxDuration = (limits) => (limits.useTime && limits.duration > 0 ? limits.duration * 60000 : null)
const maxLaps = (limits) => (limits.useLaps && limits.laps > 0 ? limits.laps : null)

export function championshipBody({ name, trackId, participants, config }) {
  return {
    name: name.trim(),
    season: new Date().getFullYear().toString(),
    trackId,
    mode: ChampionshipMode.AUTO,
    driversPerQualif: config.driversPerQualif,
    driversPerRace: config.driversPerRace,
    qualifMaxDuration: maxDuration(config.qualif),
    qualifMaxLaps: maxLaps(config.qualif),
    raceMaxDuration: maxDuration(config.race),
    raceMaxLaps: maxLaps(config.race),
    participants: participants.map((p) => ({ driverId: p.driverId })),
    sessionNames: sessionNames(),
  }
}

// The server's answer, { success, data | error }; throws when it cannot be reached
export async function createAutoChampionship(body) {
  const res = await fetch(`${API_URL}/api/championships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}
