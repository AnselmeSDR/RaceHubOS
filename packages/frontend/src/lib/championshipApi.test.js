import { SessionStatus } from '@racehubos/shared'
import { routeFetch } from '@/test/helpers'
import {
  deleteChampionship,
  deleteSession,
  finishChampionship,
  getChampionship,
  getChampionshipSessions,
  getReferenceData,
  getSessionLeaderboard,
  getStandings,
  saveSessionConfig,
} from './championshipApi'

const sent = (mock, method) =>
  mock.mock.calls.filter(([, init]) => init?.method === method).map(([url, init]) => [url, JSON.parse(init.body)])

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('reading', () => {
  test('the data of a successful answer, null otherwise', async () => {
    routeFetch({
      '/api/championships/c1': { success: true, data: { id: 'c1' } },
      '/api/championships/c2': { success: false },
      '/api/sessions?championshipId=c1': { success: true, data: [{ id: 's1' }] },
      '/api/sessions?championshipId=c2': new Error('offline'),
    })
    expect(await getChampionship('c1')).toEqual({ id: 'c1' })
    expect(await getChampionship('c2')).toBeNull()
    expect(await getChampionshipSessions('c1')).toEqual([{ id: 's1' }])
    expect(await getChampionshipSessions('c2')).toBeNull()
    expect(console.error).toHaveBeenCalledOnce()
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
  })

  test('the standings of each session type, empty when missing', async () => {
    const mock = routeFetch({
      '/api/championships/c1/standings?type=practice': { standings: ['p'] },
      '/api/championships/c1/standings?type=qualif': { standings: ['q'] },
      '/api/championships/c1/standings?type=race': {},
    })
    expect(await getStandings('c1')).toEqual({ practice: ['p'], qualif: ['q'], race: [] })
    expect(mock).toHaveBeenCalledTimes(3)
    routeFetch({ '/api/championships': new Error('offline') })
    expect(await getStandings('c1')).toBeNull()
  })

  test('a stored leaderboard, empty when it cannot be read', async () => {
    routeFetch({
      '/api/sessions/s1/leaderboard': { success: true, data: [{ id: 'e' }] },
      '/api/sessions/s2/leaderboard': { success: false },
    })
    expect(await getSessionLeaderboard('s1')).toEqual([{ id: 'e' }])
    expect(await getSessionLeaderboard('s2')).toEqual([])
  })
})

describe('saveSessionConfig', () => {
  const session = { id: 's1', status: SessionStatus.DRAFT }

  test('only the parts that changed', async () => {
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

describe('changing', () => {
  test('deleting a session or a championship', async () => {
    const mock = routeFetch({ 'DELETE /api': { success: true } })
    await deleteSession('s1')
    await deleteChampionship('c1')
    expect(mock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'DELETE /api/sessions/s1',
      'DELETE /api/championships/c1',
    ])
  })

  test('finishing a championship gives its new state', async () => {
    const mock = routeFetch({ 'PUT /api/championships/c1': { data: { id: 'c1', status: 'x' } } })
    expect(await finishChampionship('c1')).toEqual({ id: 'c1', status: 'x' })
    expect(sent(mock, 'PUT')).toEqual([['/api/championships/c1', { status: SessionStatus.FINISHED }]])
    routeFetch({ 'PUT /api/championships/c1': 500 })
    expect(await finishChampionship('c1')).toBeNull()
    routeFetch({ 'PUT /api/championships/c1': new Error('offline') })
    expect(await finishChampionship('c1')).toBeNull()
    expect(console.error).toHaveBeenCalledOnce()
  })
})
