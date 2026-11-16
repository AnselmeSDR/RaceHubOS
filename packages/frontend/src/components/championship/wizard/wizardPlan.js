import { Settings, Trophy, Users } from 'lucide-react'
import {
  carTaken,
  ChampionshipMode,
  distributeEvenly,
  distributeSequential,
  groupCount,
  isSessionUnderway,
  MAX_SESSION_DRIVERS,
  SessionType,
} from '@racehubos/shared'
import { sessionNames } from '@/lib/sessionNames'

const API_URL = import.meta.env.VITE_API_URL || ''

export const WIZARD_STEPS = [
  { key: 'info', labelKey: 'wizard.steps.info', icon: Trophy },
  { key: 'participants', labelKey: 'wizard.steps.participants', icon: Users },
  { key: 'config', labelKey: 'wizard.steps.config', icon: Settings },
]

// Each session kind is limited by a duration (minutes), a number of laps, or both; free practices may have neither
export const DEFAULT_WIZARD_CONFIG = {
  practiceCount: 1,
  driversPerQualif: 4,
  driversPerRace: 6,
  practice: { useTime: false, duration: 10, useLaps: false, laps: 0 },
  qualif: { useTime: true, duration: 5, useLaps: false, laps: 0 },
  race: { useTime: true, duration: 10, useLaps: false, laps: 0 },
}

export const MAX_PRACTICES = 20
export const MAX_GROUPS = 20

// An empty row always follows the last filled one
export function withEmptyRow(participants) {
  const lastRow = participants.at(-1)
  return !lastRow || lastRow.driverId ? [...participants, { driverId: null, driver: null, carId: null }] : participants
}

/** A participant's car by driver id: what keeps two drivers of the same car apart. */
export const carLookup = (participants) => {
  const cars = new Map(participants.map((p) => [p.driverId, p.carId || null]))
  return (driverId) => cars.get(driverId) ?? null
}

// ==================== Automatic mode ====================

const carOfEntry = (p) => p.carId || null

/**
 * The participants dealt like cards into `count` free practices, each to the emptiest that has a
 * controller and not their car: driver ids. Who fits nowhere runs no practice.
 */
export function dealtPracticeGroups(participants, count) {
  const groups = Array.from({ length: count }, () => [])
  for (const p of participants) {
    const open = groups.filter((group) => group.length < MAX_SESSION_DRIVERS && !carTaken(group, p, carOfEntry))
    open.reduce((emptiest, group) => (group.length < emptiest.length ? group : emptiest), open[0])?.push(p)
  }
  return groups.map((group) => group.map((p) => p.driverId))
}

/** The participants in none of `groups`. */
export const leftOut = (groups, participants) => {
  const placed = new Set(groups.flat())
  return participants.filter((p) => !placed.has(p.driverId))
}

/** Qualifying groups dealt like cards, two drivers of the same car never together: driver ids. */
export const dealtQualifGroups = (participants, perGroup) =>
  distributeEvenly(participants, perGroup, carOfEntry).map((group) => group.map((p) => p.driverId))

/**
 * Races share the global ranking in balanced slices, the first races taking the extra drivers;
 * one race more per driver sharing a car beyond the slices, so they can run apart.
 */
export function raceGroups(participants, perGroup) {
  const count = groupCount(participants, perGroup, carOfEntry)
  const baseSize = Math.floor(participants.length / count)
  const extra = participants.length % count
  const groups = []
  let offset = 0
  for (let g = 0; g < count; g++) {
    const size = baseSize + (g < extra ? 1 : 0)
    groups.push({ start: offset + 1, end: offset + size, count: size })
    offset += size
  }
  return groups
}

/**
 * Moves a driver to group `to`, or out of every group (`to` null): `{ groups }`, or `{ refused }`
 * when the group is full (`full`), already runs the driver's car (`car`, with the driver it clashes
 * with in `with`), or, with `keepOne` (qualifying), the driver is the last of their own group (`last`).
 */
export function moveInGroups(groups, driverId, to, perGroup, carOf, { keepOne = true } = {}) {
  const from = groups.findIndex((group) => group.includes(driverId))
  if (from === (to ?? -1)) return { groups }
  if (to === null) return { groups: groups.map((group) => group.filter((id) => id !== driverId)) }
  if (groups[to].length >= perGroup) return { refused: 'full' }
  if (keepOne && groups[from]?.length === 1) return { refused: 'last' }
  const clash = clashIn(groups[to], driverId, carOf)
  if (clash) return { refused: 'car', with: clash }
  return {
    groups: groups.map((group, g) =>
      g === from ? group.filter((id) => id !== driverId) : g === to ? [...group, driverId] : group
    ),
  }
}

/** The driver of `ids` already running `driverId`'s car, or undefined. */
const clashIn = (ids, driverId, carOf) =>
  carTaken(ids, driverId, carOf) ? ids.find((id) => id !== driverId && carOf(id) === carOf(driverId)) : undefined

const REFUSAL_KEYS = {
  full: 'wizard.refusedFull',
  last: 'wizard.refusedLast',
  already: 'wizard.refusedAlready',
  car: 'wizard.refusedCar',
}

/** Why a driver's move was refused, as a message: the driver's `name`, the one their car clashes with. */
export const refusalMessage = (reason, name, other) => ({ key: REFUSAL_KEYS[reason], vars: { name, other } })

// ==================== Manual mode ====================
// The plan is the sessions in running order: { key, type, slots }, `slots` holding a driver id or
// null per controller.

let lastKey = 0
const newSession = (type, ids = []) => ({
  key: `${type}-${++lastKey}`,
  type,
  slots: Array.from({ length: MAX_SESSION_DRIVERS }, (_, k) => ids[k] ?? null),
})

/**
 * What the automatic mode would run, to be changed by hand: its free practice and qualifying
 * groups, and the races sliced from the participants in their order, cars kept apart (a clash
 * nobody can take goes aside).
 */
export function planFromAuto({ participants, config, practiceGroups, qualifGroups, racers = participants }) {
  const races = distributeSequential(racers, config.driversPerRace, carOfEntry)
  const raceIds = races.map((group) => group.map((p) => p.driverId))
  const plan = [
    ...practiceGroups.map((ids) => newSession(SessionType.PRACTICE, ids)),
    ...qualifGroups.map((ids) => newSession(SessionType.QUALIF, ids)),
    ...raceIds.map((ids) => newSession(SessionType.RACE, ids)),
  ]
  return prunePlan(plan, participants)
}

export const sessionsOfType = (plan, type) => plan.filter((s) => s.type === type)

/** The participants in no session: set aside, to be placed. */
export function benchOf(plan, participants) {
  const placed = new Set(plan.flatMap((s) => s.slots))
  return participants.filter((p) => !placed.has(p.driverId))
}

const withSlots = (plan, index, slots) => plan.map((s, i) => (i === index ? { ...s, slots } : s))

/**
 * Moves a driver `from` a slot ({ session, slot }) or the bench (null) `to` a slot or the bench.
 * A driver dropped on a taken slot swaps with its occupant, who takes their place when free to
 * (else goes aside). `{ plan }`, or `{ refused }`: `already` when the driver runs that session,
 * `car` (clashing driver in `with`) when their car already does.
 */
export function placeDriver(plan, driverId, from, to, carOf) {
  if (!to) {
    return from ? { plan: withSlots(plan, from.session, setSlot(plan[from.session].slots, from.slot, null)) } : { plan }
  }
  if (from && from.session === to.session && from.slot === to.slot) return { plan }

  const target = plan[to.session].slots
  const occupant = target[to.slot]
  // Within one session only controllers change: no car can clash
  if (from && from.session === to.session) {
    return { plan: withSlots(plan, to.session, setSlot(setSlot(target, from.slot, occupant), to.slot, driverId)) }
  }

  const staying = target.filter((id, k) => id && k !== to.slot)
  if (staying.includes(driverId)) return { refused: 'already' }
  const clash = clashIn([...staying, driverId], driverId, carOf)
  if (clash) return { refused: 'car', with: clash }
  let next = withSlots(plan, to.session, setSlot(target, to.slot, driverId))
  if (from) {
    const others = next[from.session].slots.filter((id, k) => id && k !== from.slot)
    const fits = occupant && !others.includes(occupant) && !clashIn([...others, occupant], occupant, carOf)
    next = withSlots(next, from.session, setSlot(next[from.session].slots, from.slot, fits ? occupant : null))
  }
  return { plan: next }
}

const setSlot = (slots, index, id) => slots.map((current, k) => (k === index ? id : current))

/** The plan with session `from` moved to the place of session `to`. */
export function moveSession(plan, from, to) {
  if (from === to) return plan
  const next = [...plan]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** As many sessions of `type` as `count`: new ones after the last of the type, the last ones dropped. */
export function setSessionCount(plan, type, count) {
  const current = sessionsOfType(plan, type)
  if (count < current.length) {
    const dropped = new Set(current.slice(count).map((s) => s.key))
    return plan.filter((s) => !dropped.has(s.key))
  }
  const added = Array.from({ length: count - current.length }, () => newSession(type))
  const last = plan.findLastIndex((s) => s.type === type)
  const at = last >= 0 ? last + 1 : type === SessionType.PRACTICE ? 0 : plan.length
  return [...plan.slice(0, at), ...added, ...plan.slice(at)]
}

/**
 * The plan for a changed line-up: drivers gone are taken out, and a driver whose new car already
 * runs in a session goes aside.
 */
export function prunePlan(plan, participants) {
  const carOf = carLookup(participants)
  const ids = new Set(participants.map((p) => p.driverId))
  return plan.map((session) => {
    const kept = []
    const slots = session.slots.map((id) => {
      if (!id || !ids.has(id) || clashIn([...kept, id], id, carOf)) return null
      kept.push(id)
      return id
    })
    return { ...session, slots }
  })
}

// ==================== Creation ====================

export const hasLimit = (limits) => limits.useTime || limits.useLaps

/** Qualifying sessions and races need a limit: all of them, or with a `plan` those it holds. */
export const isConfigValid = (config, plan = null) =>
  [SessionType.QUALIF, SessionType.RACE].every(
    (type) => hasLimit(config[type]) || (plan && !sessionsOfType(plan, type).length)
  )

export const maxDuration = (limits) => (limits.useTime && limits.duration > 0 ? limits.duration * 60000 : null)
export const maxLaps = (limits) => (limits.useLaps && limits.laps > 0 ? limits.laps : null)

/** What the server needs to create the championship, in automatic mode or planned by hand. */
export function championshipBody({
  name,
  trackId,
  divisionIds = [],
  participants,
  config,
  mode,
  practiceGroups,
  qualifGroups,
  plan,
}) {
  const common = {
    name: name.trim(),
    season: new Date().getFullYear().toString(),
    trackId,
    divisionIds,
    mode,
    practiceMaxDuration: maxDuration(config.practice),
    practiceMaxLaps: maxLaps(config.practice),
    qualifMaxDuration: maxDuration(config.qualif),
    qualifMaxLaps: maxLaps(config.qualif),
    raceMaxDuration: maxDuration(config.race),
    raceMaxLaps: maxLaps(config.race),
    participants: participants.map((p) => ({ driverId: p.driverId, carId: p.carId || null })),
    sessionNames: sessionNames(),
  }
  if (mode === ChampionshipMode.MANUAL) {
    const sessions = plan.map(({ id, type, slots }) => ({
      ...(id && { id }),
      type,
      drivers: slots.flatMap((driverId, controller) => (driverId ? [{ driverId, controller }] : [])),
    }))
    return { ...common, sessions }
  }
  return {
    ...common,
    practiceCount: practiceGroups.length,
    practiceGroups,
    driversPerQualif: config.driversPerQualif,
    driversPerRace: config.driversPerRace,
    qualifGroups,
  }
}

// The server's answer, { success, data | error }; throws when it cannot be reached
export async function createChampionship(body) {
  const res = await fetch(`${API_URL}/api/championships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ==================== Editing ====================
// A session that has started never changes: the wizard shows it frozen and plans only those to come.

const byOrder = (a, b) => a.order - b.order
const byController = (a, b) => a.controller - b.controller

/** The sessions that have started and those still to come, each in running order. */
export function splitSessions(sessions) {
  const sorted = [...sessions].sort(byOrder)
  return {
    frozen: sorted.filter((s) => isSessionUnderway(s.status)),
    upcoming: sorted.filter((s) => !isSessionUnderway(s.status)),
  }
}

/** The drivers entered in a session that has started: they raced in the championship. */
export const racedDriverIds = (frozen) =>
  new Set(
    frozen
      .flatMap((s) => s.drivers ?? [])
      .map((d) => d.driverId)
      .filter(Boolean)
  )

/** The participants still to run a qualif: in none that has started. */
export function stillToQualify(participants, frozen) {
  const qualified = racedDriverIds(frozen.filter((s) => s.type === SessionType.QUALIF))
  return participants.filter((p) => !qualified.has(p.driverId))
}

/** The participants yet to run a race: the races to come take only them. */
export function stillToRace(participants, frozen) {
  const raced = racedDriverIds(frozen.filter((s) => s.type === SessionType.RACE))
  return participants.filter((p) => !raced.has(p.driverId))
}

/** A session's entries as its result: by final place when it has one, else by controller. */
export function resultOf(session) {
  const place = (d) => d.finalPos ?? d.position ?? null
  return (session.drivers ?? [])
    .filter((d) => d.driverId)
    .map((d) => ({ ...d, place: place(d) }))
    .sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || a.controller - b.controller)
}

/**
 * Who raced and is no longer a participant: retired, DNF in the sessions to come they were in.
 * Each with the car they last ran.
 */
export function retiredOf(frozen, participants) {
  const kept = new Set(participants.map((p) => p.driverId))
  const retired = new Map()
  for (const entry of frozen.flatMap((s) => s.drivers ?? [])) {
    if (!entry.driverId || kept.has(entry.driverId)) continue
    retired.set(entry.driverId, {
      driverId: entry.driverId,
      driver: entry.driver,
      carId: entry.carId ?? null,
      car: entry.car ?? null,
    })
  }
  return [...retired.values()]
}

/**
 * The retired drivers DNF in `session`: those it recorded, and in a session to come (`held`) those
 * it still holds. A session that has started keeps who ran it: only its records count.
 */
export function withdrawnIn(session, retired, held = true) {
  if (!session) return []
  const out = new Map(retired.map((r) => [r.driverId, r]))
  const ids = new Set([
    ...(session.withdrawals ?? []).map((w) => w.driverId),
    ...(held ? (session.drivers ?? []).map((d) => d.driverId) : []),
  ])
  return [...ids].filter((id) => out.has(id)).map((id) => out.get(id))
}

/** A session's drivers by controller, as the wizard's groups hold them. */
const idsOf = (session) =>
  [...(session.drivers ?? [])]
    .sort(byController)
    .map((d) => d.driverId)
    .filter(Boolean)

/** A session to come as the manual plan holds it: its id kept, a driver id or null per controller. */
function planned(session) {
  const slots = Array.from({ length: MAX_SESSION_DRIVERS }, () => null)
  for (const d of session.drivers ?? [])
    if (d.driverId && d.controller < MAX_SESSION_DRIVERS) slots[d.controller] = d.driverId
  return { key: `${session.type}-${session.id}`, id: session.id, type: session.type, slots }
}

/**
 * The championship's participants with their car; a championship created before participants
 * existed takes the drivers of its sessions, with the car they last ran.
 */
export function participantsOf(championship, sessions, cars = []) {
  const carOf = (carId) => cars.find((c) => c.id === carId) ?? null
  if (championship.participants?.length) {
    return championship.participants.map((p) => ({
      driverId: p.driverId,
      driver: p.driver,
      carId: p.carId ?? null,
      car: carOf(p.carId),
    }))
  }
  const found = new Map()
  for (const entry of [...sessions].sort(byOrder).flatMap((s) => s.drivers ?? [])) {
    if (!entry.driverId) continue
    found.set(entry.driverId, { driverId: entry.driverId, driver: entry.driver, carId: entry.carId ?? null })
  }
  return [...found.values()].map((p) => ({ ...p, car: carOf(p.carId) }))
}

const minutes = (ms) => Math.max(1, Math.round(ms / 60000))

/** Limits as the wizard edits them, from a duration (ms) and a lap count; `fallback` when unset. */
export function limitsFrom(maxDuration, maxLaps, fallback) {
  return {
    useTime: !!maxDuration,
    duration: maxDuration ? minutes(maxDuration) : fallback.duration,
    useLaps: !!maxLaps,
    laps: maxLaps || fallback.laps,
  }
}

/**
 * The championship as the wizard edits it: its settings, line-up and sessions to come (groups in
 * automatic mode, a plan by hand), beside the sessions that have started.
 */
export function editState(championship, sessions, cars = []) {
  const { frozen, upcoming } = splitSessions(sessions)
  const ofType = (list, type) => list.filter((s) => s.type === type)
  const practice = ofType(upcoming, SessionType.PRACTICE)[0] ?? ofType(frozen, SessionType.PRACTICE).at(-1) ?? null
  const defaults = DEFAULT_WIZARD_CONFIG
  const manual = championship.mode === ChampionshipMode.MANUAL
  return {
    name: championship.name ?? '',
    trackId: championship.trackId ?? '',
    divisionIds: (championship.divisions ?? []).map((d) => d.id),
    participants: participantsOf(championship, sessions, cars),
    mode: championship.mode,
    frozen,
    upcoming,
    config: {
      practiceCount: ofType(upcoming, SessionType.PRACTICE).length,
      driversPerQualif: championship.driversPerQualif ?? defaults.driversPerQualif,
      driversPerRace: championship.driversPerRace ?? defaults.driversPerRace,
      practice: practice ? limitsFrom(practice.maxDuration, practice.maxLaps, defaults.practice) : defaults.practice,
      qualif: limitsFrom(championship.qualifMaxDuration, championship.qualifMaxLaps, defaults.qualif),
      race: limitsFrom(championship.raceMaxDuration, championship.raceMaxLaps, defaults.race),
    },
    practiceGroups: ofType(upcoming, SessionType.PRACTICE).map(idsOf),
    qualifGroups: ofType(upcoming, SessionType.QUALIF).map(idsOf),
    plan: manual ? upcoming.filter((s) => s.type !== SessionType.BALANCING).map(planned) : null,
  }
}

/**
 * Whether `groups` hold each of `participants` once (at most once unless `everyone`), as many
 * groups as `count`.
 */
export function holdsEachOnce(groups, participants, count, { everyone = true } = {}) {
  const placed = groups.flat()
  const ids = new Set(participants.map((p) => p.driverId))
  return (
    groups.length === count &&
    (!everyone || placed.length === ids.size) &&
    new Set(placed).size === placed.length &&
    placed.every((id) => ids.has(id))
  )
}

/** The races of an automatic championship: those that ran, then as many to come as the line-up needs. */
export function upcomingRaceGroups(participants, perGroup, ranCount) {
  return raceGroups(participants, perGroup).slice(ranCount)
}

/** What the server needs to apply the edit: as for a creation, the sessions to come only. */
export const editBody = (args) => {
  const body = championshipBody(args)
  if (body.mode === ChampionshipMode.AUTO) delete body.practiceCount
  return body
}

/** The edit applied: `{ success, data | error }`; throws when the server cannot be reached. */
export async function saveChampionshipEdit(id, body) {
  const res = await fetch(`${API_URL}/api/championships/${id}/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}
