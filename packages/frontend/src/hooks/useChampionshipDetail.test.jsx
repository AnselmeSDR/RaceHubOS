import { act, renderHook, waitFor } from '@testing-library/react'
import { ChampionshipMode, SessionStatus } from '@racehubos/shared'
import { routeFetch } from '@/test/helpers'
import { useChampionshipDetail } from './useChampionshipDetail'

const s1 = { id: 's1' }
const s2 = { id: 's2' }
const drivers = [{ id: 'd1' }, { id: 'd2' }]

/** The API of championship c1 with `sessions`, the other answers overridable. */
function api(sessions, overrides = {}) {
  return routeFetch({
    '/api/championships/c1': { success: true, data: { id: 'c1', mode: ChampionshipMode.MANUAL } },
    '/api/championships/c1/standings': (url) => ({ standings: [url.split('=')[1]] }),
    '/api/sessions?championshipId=c1': () => ({ success: true, data: sessions() }),
    '/api/drivers': { success: true, data: drivers },
    '/api/cars': { success: true, data: ['car'] },
    '/api/tracks': { success: true, data: ['track'] },
    ...overrides,
  })
}

async function loaded(id = 'c1') {
  const hook = renderHook(({ id }) => useChampionshipDetail(id), { initialProps: { id } })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

test('loads the championship, its sessions, the reference data and the standings', async () => {
  api(() => [s1, s2])
  const { result } = renderHook(() => useChampionshipDetail('c1'))
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.championship).toEqual({ id: 'c1', mode: ChampionshipMode.MANUAL })
  expect(result.current.sessions).toEqual([s1, s2])
  expect(result.current.drivers).toEqual(drivers)
  expect(result.current.sessionDrivers).toBe(result.current.drivers)
  expect(result.current.cars).toEqual(['car'])
  expect(result.current.tracks).toEqual(['track'])
  expect(result.current.standings).toEqual({ practice: ['practice'], qualif: ['qualif'], race: ['race'] })
})

test('keeps what it has when an answer fails', async () => {
  api(() => [], {
    '/api/championships/c1': { success: false },
    '/api/championships/c1/standings': new Error('offline'),
    '/api/sessions?championshipId=c1': { success: false },
    '/api/cars': { success: false },
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { result } = await loaded()
  expect(result.current.championship).toBeNull()
  expect(result.current.sessions).toEqual([])
  expect(result.current.cars).toEqual([])
  expect(result.current.standings).toEqual({ practice: [], qualif: [], race: [] })
  expect(result.current.selectedSession).toBeNull()
  vi.restoreAllMocks()
})

describe('the selected session', () => {
  test('the first one when none was chosen, remembered for the championship', async () => {
    api(() => [s1, s2])
    const { result } = await loaded()
    expect(result.current.selectedSession).toBe(s1)
    expect(localStorage.getItem('championship_c1_session')).toBe('s1')
    act(() => result.current.selectSession('s2'))
    expect(result.current.selectedSession).toBe(s2)
    expect(localStorage.getItem('championship_c1_session')).toBe('s2')
  })

  test('the remembered one when it still exists', async () => {
    localStorage.setItem('championship_c1_session', 's2')
    api(() => [s1, s2])
    const { result } = await loaded()
    expect(result.current.selectedSession).toBe(s2)
  })

  test('the first one in place of a remembered session that is gone', async () => {
    localStorage.setItem('championship_c1_session', 'gone')
    api(() => [s1, s2])
    const { result } = await loaded()
    expect(result.current.selectedSession).toBe(s1)
    expect(localStorage.getItem('championship_c1_session')).toBe('s1')
  })

  test('the first one in place of an unknown session picked elsewhere', async () => {
    api(() => [s1, s2])
    const { result } = await loaded()
    act(() => result.current.selectSession('s2'))
    act(() => result.current.selectSession('elsewhere'))
    expect(result.current.selectedSession).toBe(s1)
  })

  test('none once cleared, until the sessions reload with nothing selected', async () => {
    let sessions = [s1, s2]
    api(() => sessions)
    const { result } = await loaded()
    // Deleting the selected session: the reload started before clearing keeps the selection empty
    sessions = [s2]
    await act(async () => {
      const reload = result.current.reloadSessions()
      result.current.selectSession(null)
      await reload
    })
    expect(result.current.selectedSession).toBeNull()
    expect(localStorage.getItem('championship_c1_session')).toBeNull()
    await act(() => result.current.reloadSessions())
    expect(result.current.selectedSession).toBe(s2)
  })

  test('a remembered session is kept while there are no sessions', async () => {
    localStorage.setItem('championship_c1_session', 's9')
    api(() => [])
    const { result } = await loaded()
    expect(result.current.selectedSession).toBeNull()
    expect(localStorage.getItem('championship_c1_session')).toBe('s9')
  })
})

test('an automatic championship configures its sessions with its participants only', async () => {
  api(() => [], {
    '/api/championships/c1': {
      success: true,
      data: { id: 'c1', mode: ChampionshipMode.AUTO, participants: [{ driverId: 'd2' }] },
    },
  })
  const { result } = await loaded()
  expect(result.current.sessionDrivers).toEqual([{ id: 'd2' }])
})

test('an automatic championship without participants offers every driver', async () => {
  api(() => [], {
    '/api/championships/c1': { success: true, data: { id: 'c1', mode: ChampionshipMode.AUTO, participants: [] } },
  })
  const { result } = await loaded()
  expect(result.current.sessionDrivers).toEqual(drivers)
})

test.each(['session:finished', 'session:status_changed', 'championship:races_assigned'])(
  '%s reloads the sessions and the standings',
  async (event) => {
    let sessions = [s1]
    const mock = api(() => sessions)
    const { result, unmount } = await loaded()
    sessions = [s1, s2]
    mock.mockClear()
    act(() => window.dispatchEvent(new Event(event)))
    await waitFor(() => expect(result.current.sessions).toEqual([s1, s2]))
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      '/api/sessions?championshipId=c1',
      '/api/championships/c1/standings?type=practice',
      '/api/championships/c1/standings?type=qualif',
      '/api/championships/c1/standings?type=race',
    ])
    // Not listened to anymore once gone
    unmount()
    mock.mockClear()
    window.dispatchEvent(new Event(event))
    expect(mock).not.toHaveBeenCalled()
  }
)

test('finishing updates the championship, unless it failed', async () => {
  api(() => [], { 'PUT /api/championships/c1': { data: { id: 'c1', status: SessionStatus.FINISHED } } })
  const { result } = await loaded()
  await act(() => result.current.finish())
  expect(result.current.championship).toEqual({ id: 'c1', status: SessionStatus.FINISHED })
  api(() => [], { 'PUT /api/championships/c1': 500 })
  await act(() => result.current.finish())
  expect(result.current.championship).toEqual({ id: 'c1', status: SessionStatus.FINISHED })
})

test('loads again for another championship', async () => {
  api(() => [s1], {
    '/api/championships/c2': { success: true, data: { id: 'c2' } },
    '/api/championships/c2/standings': {},
    '/api/sessions?championshipId=c2': { success: true, data: [] },
  })
  const { result, rerender } = await loaded()
  rerender({ id: 'c2' })
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.championship).toEqual({ id: 'c2' }))
  expect(result.current.loading).toBe(false)
})
