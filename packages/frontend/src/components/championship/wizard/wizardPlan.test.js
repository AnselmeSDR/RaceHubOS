import { ChampionshipMode, SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import {
  benchOf,
  championshipBody,
  createChampionship,
  dealtPracticeGroups,
  dealtQualifGroups,
  DEFAULT_WIZARD_CONFIG,
  editState,
  holdsEachOnce,
  leftOut,
  isConfigValid,
  moveInGroups,
  moveSession,
  placeDriver,
  planFromAuto,
  prunePlan,
  raceGroups,
  resultOf,
  setSessionCount,
  stillToRace,
  withEmptyRow,
} from './wizardPlan'

const { PRACTICE, QUALIF, RACE } = SessionType
const { DRAFT, FINISHED } = SessionStatus
// Ana and Cid share a Ferrari
const CARS = { d1: 'ferrari', d3: 'ferrari' }
const carOf = (id) => CARS[id] ?? null
const entry = (driverId, carId = CARS[driverId] ?? null) => ({ driverId, driver: { id: driverId }, carId })
const lineUp = (...ids) => ids.map((id) => entry(id))
const EMPTY = { driverId: null, driver: null, carId: null }
const noLimit = { useTime: false, duration: 5, useLaps: false, laps: 0 }

// A plan written by hand: a session's drivers on its first controllers
let key = 0
const session = (type, ids = []) => ({
  key: `s${++key}`,
  type,
  slots: Array.from({ length: 6 }, (_, k) => ids[k] ?? null),
})
const drivers = (plan) => plan.map((s) => s.slots.filter(Boolean))

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => vi.unstubAllGlobals())

test('an empty row always follows the last filled one', () => {
  expect(withEmptyRow([])).toEqual([EMPTY])
  expect(withEmptyRow([entry('d1')])).toEqual([entry('d1'), EMPTY])
  const lastEmpty = [entry('d1'), EMPTY]
  expect(withEmptyRow(lastEmpty)).toBe(lastEmpty)
})

test('qualifying groups are dealt like cards, two drivers of the same car apart', () => {
  expect(dealtQualifGroups(lineUp('d1', 'd2', 'd4', 'd5', 'd6'), 2)).toEqual([['d1', 'd5'], ['d2', 'd6'], ['d4']])
  // Dealt, Ana and Cid would share the first group
  expect(dealtQualifGroups(lineUp('d1', 'd2', 'd3', 'd4'), 2)).toEqual([
    ['d1', 'd2'],
    ['d3', 'd4'],
  ])
  expect(dealtQualifGroups([], 4)).toEqual([])
})

test('races share the ranking in balanced slices, the first ones take the extra drivers', () => {
  expect(raceGroups(lineUp('d2', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'), 3)).toEqual([
    { start: 1, end: 3, count: 3 },
    { start: 4, end: 5, count: 2 },
    { start: 6, end: 7, count: 2 },
  ])
  expect(raceGroups(lineUp('d2', 'd4', 'd5', 'd6', 'd7', 'd8'), 6)).toEqual([{ start: 1, end: 6, count: 6 }])
  expect(raceGroups([], 6)).toEqual([])
})

test('one race more when the drivers sharing a car outnumber the slices: they run apart', () => {
  // Six drivers fit one race, but Ana and Cid share the Ferrari
  expect(raceGroups(lineUp('d1', 'd2', 'd3', 'd4', 'd5', 'd6'), 6)).toEqual([
    { start: 1, end: 3, count: 3 },
    { start: 4, end: 6, count: 3 },
  ])
  expect(dealtQualifGroups(lineUp('d1', 'd2', 'd3'), 4)).toEqual([['d1', 'd2'], ['d3']])
})

test('as many free practices as wanted: who finds no controller, or only one with their car, runs none', () => {
  const eight = Array.from({ length: 8 }, (_, i) => entry(`x${i}`))
  expect(dealtPracticeGroups(eight, 1)).toEqual([['x0', 'x1', 'x2', 'x3', 'x4', 'x5']])
  expect(leftOut(dealtPracticeGroups(eight, 1), eight).map((p) => p.driverId)).toEqual(['x6', 'x7'])
  // Ana and Cid share the Ferrari
  expect(dealtPracticeGroups(lineUp('d1', 'd2', 'd3'), 1)).toEqual([['d1', 'd2']])
})

test('the participants dealt like cards into the free practices, cars apart, some maybe empty', () => {
  expect(dealtPracticeGroups(lineUp('d1', 'd2', 'd3', 'd4'), 2)).toEqual([
    ['d1', 'd4'],
    ['d2', 'd3'],
  ])
  expect(dealtPracticeGroups(lineUp('d2', 'd4'), 3)).toEqual([['d2'], ['d4'], []])
  expect(dealtPracticeGroups(lineUp('d2'), 0)).toEqual([])
})

describe('moving a driver between qualifying groups', () => {
  const groups = [
    ['d1', 'd2'],
    ['d3', 'd4'],
  ]

  test.each([
    ['joins a group with room', 'd2', 1, 3, { groups: [['d1'], ['d3', 'd4', 'd2']] }],
    ['stays where it is', 'd2', 0, 2, { groups }],
    ['is refused by a full group', 'd2', 1, 2, { refused: 'full' }],
    ['is refused where its car already runs', 'd1', 1, 3, { refused: 'car', with: 'd3' }],
  ])('a driver %s', (_, driverId, to, perGroup, expected) => {
    expect(moveInGroups(groups, driverId, to, perGroup, carOf)).toEqual(expected)
  })

  test('a driver leaves every group, or joins one from none (practices)', () => {
    expect(moveInGroups(groups, 'd2', null, 6, carOf, { keepOne: false })).toEqual({ groups: [['d1'], ['d3', 'd4']] })
    expect(moveInGroups([['d1'], ['d4']], 'd2', 1, 6, carOf, { keepOne: false })).toEqual({
      groups: [['d1'], ['d4', 'd2']],
    })
    expect(moveInGroups([['d2'], ['d4']], 'd3', 0, 6, carOf, { keepOne: false })).toEqual({
      groups: [['d2', 'd3'], ['d4']],
    })
  })

  test('the last driver of a group stays: a group is never emptied, unless it may be (practices)', () => {
    expect(moveInGroups([['d2'], ['d4']], 'd2', 1, 3, carOf)).toEqual({ refused: 'last' })
    expect(moveInGroups([['d2'], ['d4']], 'd2', 1, 6, carOf, { keepOne: false })).toEqual({
      groups: [[], ['d4', 'd2']],
    })
  })
})

describe('placing a driver by hand', () => {
  // FP1 empty, Q1 Ana Ben, Q2 Cid, R1 Dan
  const plan = [session(PRACTICE), session(QUALIF, ['d1', 'd2']), session(QUALIF, ['d3']), session(RACE, ['d4'])]
  const place = (driverId, from, to) => placeDriver(plan, driverId, from, to, carOf)
  const at = (s, slot) => ({ session: s, slot })

  test('from the drivers aside onto a free controller', () => {
    const { plan: next } = place('d5', null, at(2, 3))
    expect(next[2].slots).toEqual(['d3', null, null, 'd5', null, null])
  })

  test('onto a taken controller: its driver is set aside when the dragged one came from aside', () => {
    const { plan: next } = place('d5', null, at(1, 0))
    expect(drivers(next)).toEqual([[], ['d5', 'd2'], ['d3'], ['d4']])
    expect(
      benchOf(
        next,
        ['d1', 'd2', 'd3', 'd4', 'd5'].map((id) => entry(id))
      ).map((p) => p.driverId)
    ).toEqual(['d1'])
  })

  test('within a session, only controllers change: two drivers swap', () => {
    expect(place('d1', at(1, 0), at(1, 1)).plan[1].slots).toEqual(['d2', 'd1', null, null, null, null])
    expect(place('d1', at(1, 0), at(1, 4)).plan[1].slots).toEqual([null, 'd2', null, null, 'd1', null])
  })

  test('between sessions, two drivers swap when the other one fits', () => {
    expect(drivers(place('d2', at(1, 1), at(3, 0)).plan)).toEqual([[], ['d1', 'd4'], ['d3'], ['d2']])
    // Two drivers of the same car can swap their sessions
    expect(drivers(place('d3', at(2, 0), at(1, 0)).plan)).toEqual([[], ['d3', 'd2'], ['d1'], ['d4']])
  })

  test('the driver pushed out goes aside when their car runs where they would land', () => {
    expect(drivers(place('d2', at(1, 1), at(2, 0)).plan)).toEqual([[], ['d1'], ['d2'], ['d4']])
  })

  test('refused: a driver twice in a session, or a car twice', () => {
    const twice = [session(QUALIF, ['d1', 'd2']), session(RACE, ['d1'])]
    expect(placeDriver(twice, 'd1', at(0, 0), at(1, 2), carOf)).toEqual({ refused: 'already' })
    expect(place('d3', at(2, 0), at(1, 2))).toEqual({ refused: 'car', with: 'd1' })
    expect(place('d3', null, at(1, 2))).toEqual({ refused: 'car', with: 'd1' })
  })

  test('set aside from a session; aside to aside changes nothing', () => {
    expect(drivers(place('d2', at(1, 1), null).plan)).toEqual([[], ['d1'], ['d3'], ['d4']])
    expect(place('d5', null, null).plan).toBe(plan)
  })
})

test('a session moved to the place of another one', () => {
  const [a, b, c] = [session(PRACTICE), session(QUALIF, []), session(RACE, [])]
  expect(moveSession([a, b, c], 0, 2)).toEqual([b, c, a])
  expect(moveSession([a, b, c], 2, 0)).toEqual([c, a, b])
  const plan = [a, b]
  expect(moveSession(plan, 1, 1)).toBe(plan)
})

describe('the number of sessions of a kind', () => {
  const plan = [session(PRACTICE), session(QUALIF, ['d1']), session(QUALIF, ['d2']), session(RACE, ['d3'])]
  const types = (next) => next.map((s) => s.type)

  test('new ones after the last of their kind, empty', () => {
    const next = setSessionCount(plan, QUALIF, 3)
    expect(types(next)).toEqual([PRACTICE, QUALIF, QUALIF, QUALIF, RACE])
    expect(next[3].slots).toEqual(Array(6).fill(null))
    expect(new Set(next.map((s) => s.key)).size).toBe(5)
  })

  test('the last ones of the kind dropped', () => {
    expect(drivers(setSessionCount(plan, QUALIF, 1))).toEqual([[], ['d1'], ['d3']])
  })

  test('the first of a kind: free practices open the championship, the others close it', () => {
    const bare = [session(QUALIF, [])]
    expect(types(setSessionCount(bare, PRACTICE, 2))).toEqual([PRACTICE, PRACTICE, QUALIF])
    expect(setSessionCount(bare, PRACTICE, 2)[0].slots).toEqual(Array(6).fill(null))
    expect(types(setSessionCount(bare, RACE, 1))).toEqual([QUALIF, RACE])
  })
})

test('a changed line-up: drivers gone are taken out, a new car already in a session goes aside', () => {
  const plan = [session(PRACTICE, ['d2', 'd4']), session(QUALIF, ['d1', 'd2']), session(QUALIF, ['d3', 'd4'])]
  // Ben left, Dan now runs the Ferrari too
  const next = prunePlan(plan, [entry('d1'), entry('d3'), entry('d4', 'ferrari')])
  expect(next[0].slots).toEqual([null, 'd4', null, null, null, null])
  expect(next[1].slots).toEqual(['d1', null, null, null, null, null])
  expect(next[2].slots).toEqual(['d3', null, null, null, null, null])
})

test('going manual starts from the automatic split: races sliced from the line-up, cars apart', () => {
  // Ana and Ben share a BMW here
  const participants = [entry('d1', 'bmw'), entry('d2', 'bmw'), entry('d3', null), entry('d4'), entry('d5')]
  const groups = [
    ['d1', 'd3', 'd5'],
    ['d2', 'd4'],
  ]
  const plan = planFromAuto({
    participants,
    config: { ...DEFAULT_WIZARD_CONFIG, driversPerRace: 3 },
    practiceGroups: [['d4', 'd5'], ['d1', 'd2', 'd3'], []],
    qualifGroups: groups,
  })
  expect(plan.map((s) => s.type)).toEqual([PRACTICE, PRACTICE, PRACTICE, QUALIF, QUALIF, RACE, RACE])
  // Ana and Ben together in FP2 are not kept: Ben goes aside from it
  expect(drivers(plan)).toEqual([
    ['d4', 'd5'],
    ['d1', 'd3'],
    [],
    ['d1', 'd3', 'd5'],
    ['d2', 'd4'],
    ['d1', 'd4', 'd3'],
    ['d2', 'd5'],
  ])
  expect(benchOf(plan, participants)).toEqual([])
})

test('qualifying sessions and races need a duration or a number of laps, a plan only those it holds', () => {
  expect(isConfigValid(DEFAULT_WIZARD_CONFIG)).toBe(true)
  expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, qualif: noLimit })).toBe(false)
  expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, race: noLimit })).toBe(false)
  expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, race: { ...noLimit, useLaps: true } })).toBe(true)
  const racesOnly = [session(RACE, [])]
  expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, qualif: noLimit }, racesOnly)).toBe(true)
  expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, race: noLimit }, racesOnly)).toBe(false)
})

describe('the body sent', () => {
  const config = {
    practiceCount: 2,
    driversPerQualif: 3,
    driversPerRace: 5,
    practice: { useTime: true, duration: 15, useLaps: false, laps: 20 },
    qualif: { useTime: false, duration: 5, useLaps: true, laps: 8 },
    race: { useTime: true, duration: 0, useLaps: true, laps: 0 },
  }
  const common = {
    name: 'Cup',
    season: String(new Date().getFullYear()),
    trackId: 't1',
    practiceMaxDuration: 900000,
    practiceMaxLaps: null,
    qualifMaxDuration: null,
    qualifMaxLaps: 8,
    raceMaxDuration: null,
    raceMaxLaps: null,
    participants: [
      { driverId: 'd1', carId: 'ferrari' },
      { driverId: 'd2', carId: null },
    ],
    sessionNames: expect.objectContaining({ [RACE]: 'Race' }),
    divisionIds: ['gold', 'gt3'],
  }
  const base = {
    name: '  Cup ',
    trackId: 't1',
    participants: [entry('d1'), entry('d2')],
    divisionIds: ['gold', 'gt3'],
    config,
  }

  test('automatic: minutes in ms, unused or empty limits left out, the groups as moved', () => {
    const qualifGroups = [['d2'], ['d1']]
    const practiceGroups = [['d1', 'd2'], [], []]
    expect(championshipBody({ ...base, mode: ChampionshipMode.AUTO, practiceGroups, qualifGroups })).toEqual({
      ...common,
      mode: ChampionshipMode.AUTO,
      practiceCount: 3,
      practiceGroups,
      driversPerQualif: 3,
      driversPerRace: 5,
      qualifGroups,
    })
  })

  test('manual: the sessions in running order, each driver on their controller', () => {
    const plan = [session(QUALIF, [null, 'd2']), session(PRACTICE), session(RACE, [])]
    expect(championshipBody({ ...base, mode: ChampionshipMode.MANUAL, plan })).toEqual({
      ...common,
      mode: ChampionshipMode.MANUAL,
      sessions: [
        { type: QUALIF, drivers: [{ driverId: 'd2', controller: 1 }] },
        { type: PRACTICE, drivers: [] },
        { type: RACE, drivers: [] },
      ],
    })
  })
})

test("creating posts the body and returns the server's answer", async () => {
  const mock = routeFetch({ 'POST /api/championships': { success: true, data: { id: 'c1' } } })
  expect(await createChampionship({ name: 'Cup' })).toEqual({ success: true, data: { id: 'c1' } })
  expect(mock).toHaveBeenCalledWith('/api/championships', expect.objectContaining({ body: '{"name":"Cup"}' }))
})

describe('editing a championship under way', () => {
  const seat = (driverId, controller, data = {}) => ({ driverId, driver: { id: driverId }, controller, ...data })
  const session = (id, type, status, order, drivers = [], data = {}) => ({ id, type, status, order, drivers, ...data })

  test('the settings it runs with; the sessions that ran apart from those to come, planned by id', () => {
    const championship = {
      name: 'Cup',
      trackId: 't1',
      mode: ChampionshipMode.MANUAL,
      qualifMaxDuration: 240000,
      raceMaxLaps: 20,
      participants: [{ driverId: 'd1', driver: { id: 'd1' }, carId: 'ferrari' }],
    }
    const sessions = [
      session('r1', RACE, DRAFT, 2, [seat('d1', 3)]),
      session('fp2', PRACTICE, DRAFT, 1, [], { maxLaps: 8 }),
      session('fp1', PRACTICE, FINISHED, 0),
    ]
    const state = editState(championship, sessions, [{ id: 'ferrari', brand: 'Ferrari' }])

    expect(state.frozen.map((s) => s.id)).toEqual(['fp1'])
    expect(state.participants).toEqual([
      { driverId: 'd1', driver: { id: 'd1' }, carId: 'ferrari', car: { id: 'ferrari', brand: 'Ferrari' } },
    ])
    expect(state.config).toMatchObject({
      practiceCount: 1,
      practice: { useTime: false, useLaps: true, laps: 8 },
      qualif: { useTime: true, duration: 4, useLaps: false },
      race: { useTime: false, useLaps: true, laps: 20 },
    })
    expect(state.plan.map((s) => [s.id, s.type, s.slots])).toEqual([
      ['fp2', PRACTICE, [null, null, null, null, null, null]],
      ['r1', RACE, [null, null, null, 'd1', null, null]],
    ])
  })

  test('a championship without participants takes the drivers of its sessions, with the car they last ran', () => {
    const sessions = [
      session('q1', QUALIF, FINISHED, 0, [seat('d1', 0, { carId: 'bmw' }), seat('d2', 1)]),
      session('q2', QUALIF, DRAFT, 1, [seat('d1', 0, { carId: 'ferrari' })]),
    ]
    const state = editState({ mode: ChampionshipMode.MANUAL, participants: [] }, sessions)
    expect(state.participants.map((p) => [p.driverId, p.carId])).toEqual([
      ['d1', 'ferrari'],
      ['d2', null],
    ])
  })

  test('a result by place, those without one by controller; the races to come take who has not raced', () => {
    const race = session('r1', RACE, FINISHED, 0, [
      seat('d3', 0),
      seat('d1', 1, { finalPos: 2 }),
      seat('d2', 2, { finalPos: 1 }),
      seat(null, 3),
    ])
    expect(resultOf(race).map((e) => [e.driverId, e.place])).toEqual([
      ['d2', 1],
      ['d1', 2],
      ['d3', null],
    ])
    expect(stillToRace(lineUp('d1', 'd4'), [race]).map((p) => p.driverId)).toEqual(['d4'])
  })

  test('groups are kept only while they hold each participant once, as many as dealt', () => {
    const drivers = lineUp('d1', 'd2', 'd3')
    expect(holdsEachOnce([['d1', 'd2'], ['d3']], drivers, 2)).toBe(true)
    expect(holdsEachOnce([['d1', 'd2', 'd3']], drivers, 2)).toBe(false)
    expect(holdsEachOnce([['d1', 'd1'], ['d3']], drivers, 2)).toBe(false)
    expect(holdsEachOnce([['d1'], ['d3']], drivers, 2)).toBe(false)
    // Free practices: a driver may run none, never two
    expect(holdsEachOnce([['d1'], ['d3']], drivers, 2, { everyone: false })).toBe(true)
    expect(holdsEachOnce([['d1', 'd1'], ['d3']], drivers, 2, { everyone: false })).toBe(false)
  })
})
