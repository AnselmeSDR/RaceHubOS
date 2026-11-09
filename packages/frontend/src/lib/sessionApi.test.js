import { SessionStatus, SessionType } from '@racehubos/shared'
import { routeFetch } from '@/test/helpers'
import {
  deleteSession,
  driverAssignments,
  getReferenceData,
  getSessionLeaderboard,
  getTrackStandings,
  saveSessionConfig,
  setSessionDrivers,
  shareFreeSessionDrivers,
} from './sessionApi'

const sent = (mock, method) =>
  mock.mock.calls.filter(([, init]) => init?.method === method).map(([url, init]) => [url, JSON.parse(init.body)])

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('the drivers, cars and tracks that could be read', async () => {
  routeFetch({
    '/api/drivers': { success: true, data: ['d'] },
    '/api/cars': { success: false },
    '/api/tracks': { success: true, data: ['t'] },
  })
  expect(await getReferenceData()).toEqual({ drivers: ['d'], cars: undefined, tracks: ['t'] })
  routeFetch({ '/api/drivers': new Error('offline') })
  expect(await getReferenceData()).toEqual({})
  expect(console.error).toHaveBeenCalledOnce()
})

test('a stored leaderboard, empty when it cannot be read', async () => {
  routeFetch({
    '/api/sessions/s1/leaderboard': { success: true, data: [{ id: 'e' }] },
    '/api/sessions/s2/leaderboard': { success: false },
    '/api/sessions/s3/leaderboard': new Error('offline'),
  })
  expect(await getSessionLeaderboard('s1')).toEqual([{ id: 'e' }])
  expect(await getSessionLeaderboard('s2')).toEqual([])
  expect(await getSessionLeaderboard('s3')).toEqual([])
})

test("a session's line-up as it is saved", async () => {
  expect(driverAssignments([{ id: 'x', controller: 1, driverId: 'd', carId: 'c', driver: {} }])).toEqual([
    { controller: 1, driverId: 'd', carId: 'c' },
  ])
  const mock = routeFetch({ 'PUT /api/sessions/s1/drivers': { success: true } })
  await setSessionDrivers('s1', [{ controller: 1 }])
  expect(sent(mock, 'PUT')).toEqual([['/api/sessions/s1/drivers', { drivers: [{ controller: 1 }] }]])
})

describe('saveSessionConfig', () => {
  const session = { id: 's1', status: SessionStatus.DRAFT }

  test('only the settings that changed', async () => {
    const mock = routeFetch({ '/api/sessions/s1': { success: true } })
    await saveSessionConfig(session, { maxLaps: 20 })
    // Unchanged settings are left out of the body
    expect(sent(mock, 'PUT')).toEqual([['/api/sessions/s1', { maxLaps: 20 }]])
    expect(mock).toHaveBeenCalledOnce()
  })

  test('the status when it is a new one, the drivers when there are some', async () => {
    const mock = routeFetch({ '/api/sessions/s1': { success: true } })
    await saveSessionConfig(session, { status: SessionStatus.DRAFT, drivers: [] })
    expect(mock).not.toHaveBeenCalled()
    await saveSessionConfig(session, { status: SessionStatus.READY, drivers: [{ controller: 1 }] })
    expect(sent(mock, 'PATCH')).toEqual([['/api/sessions/s1/status', { status: SessionStatus.READY }]])
    expect(sent(mock, 'PUT')).toEqual([['/api/sessions/s1/drivers', { drivers: [{ controller: 1 }] }]])
  })
})

test('deleting a session', async () => {
  const mock = routeFetch({ 'DELETE /api/sessions/s1': { success: true } })
  await deleteSession('s1')
  expect(mock).toHaveBeenCalledWith('/api/sessions/s1', { method: 'DELETE' })
})

test('the line-up goes to the latest free session of each other type, when still a draft', async () => {
  const drivers = [{ controller: 1, driverId: 'd1' }]
  const mock = routeFetch({
    [`/api/sessions?trackId=t1&type=${SessionType.QUALIF}`]: {
      success: true,
      data: [
        { id: 'old', status: SessionStatus.DRAFT, createdAt: '2026-01-01' },
        { id: 'new', status: SessionStatus.DRAFT, createdAt: '2026-02-01' },
      ],
    },
    [`/api/sessions?trackId=t1&type=${SessionType.RACE}`]: {
      success: true,
      data: [{ id: 'done', status: SessionStatus.FINISHED, createdAt: '2026-02-01' }],
    },
    'PUT /api/sessions': { success: true },
  })
  await shareFreeSessionDrivers('t1', SessionType.PRACTICE, drivers)
  expect(sent(mock, 'PUT')).toEqual([['/api/sessions/new/drivers', { drivers }]])
  expect(mock.mock.calls.map(([url]) => url)).toContain(
    `/api/sessions?trackId=t1&type=${SessionType.RACE}&championshipId=null`
  )
  expect(mock.mock.calls.some(([url]) => url.includes(`type=${SessionType.PRACTICE}`))).toBe(false)
})

test('no line-up shared when the other types have no free session', async () => {
  const mock = routeFetch({ '/api/sessions?trackId=t1': { success: true, data: [] } })
  await shareFreeSessionDrivers('t1', SessionType.RACE, [{ controller: 1 }])
  expect(sent(mock, 'PUT')).toEqual([])
})

describe('getTrackStandings', () => {
  test('the best laps by type, race totals defaulted', async () => {
    routeFetch({
      '/api/records/track/t1?championshipId=null': {
        success: true,
        data: {
          practice: [{ id: 'p', lapTime: 7000 }],
          race: [
            { id: 'r1', lapTime: 7100, totalLaps: 12, totalTime: 90000 },
            { id: 'r2', lapTime: 7200, laps: 9 },
            { id: 'r3', lapTime: 7300 },
          ],
        },
      },
    })
    expect(await getTrackStandings('t1')).toEqual({
      practice: [{ id: 'p', lapTime: 7000, bestTime: 7000 }],
      qualif: [],
      race: [
        { id: 'r1', lapTime: 7100, bestTime: 7100, totalLaps: 12, totalTime: 90000 },
        { id: 'r2', lapTime: 7200, bestTime: 7200, laps: 9, totalLaps: 9, totalTime: null },
        { id: 'r3', lapTime: 7300, bestTime: 7300, totalLaps: 0, totalTime: null },
      ],
    })
  })

  test('null when unreadable', async () => {
    routeFetch({ '/api/records/track/t1': { success: false }, '/api/records/track/t2': new Error('offline') })
    expect(await getTrackStandings('t1')).toBeNull()
    expect(await getTrackStandings('t2')).toBeNull()
    expect(console.error).toHaveBeenCalledOnce()
  })
})
