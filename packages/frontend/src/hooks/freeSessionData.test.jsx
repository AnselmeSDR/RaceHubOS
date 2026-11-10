import { act, renderHook, waitFor } from '@testing-library/react'
import { routeFetch } from '@/test/helpers'
import { useFreeSessionReferences } from './useFreeSessionReferences'
import { useTrackStandings } from './useTrackStandings'

const tracks = [{ id: 't1' }, { id: 't2' }]

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useFreeSessionReferences', () => {
  const api = (overrides = {}) =>
    routeFetch({
      '/api/tracks': { success: true, data: tracks },
      '/api/drivers': { success: true, data: ['d'] },
      '/api/cars': { success: true, data: ['c'] },
      ...overrides,
    })

  test('the tracks, drivers and cars, the first track chosen when none was', async () => {
    api()
    const setTrackId = vi.fn()
    const { result } = renderHook(() => useFreeSessionReferences(null, setTrackId))
    await waitFor(() => expect(result.current.tracks).toEqual(tracks))
    expect(result.current.drivers).toEqual(['d'])
    expect(result.current.cars).toEqual(['c'])
    expect(setTrackId).toHaveBeenCalledWith('t1')
  })

  test('a chosen track is kept', async () => {
    api()
    const setTrackId = vi.fn()
    const { result } = renderHook(() => useFreeSessionReferences('t2', setTrackId))
    await waitFor(() => expect(result.current.tracks).toEqual(tracks))
    expect(setTrackId).not.toHaveBeenCalled()
  })

  test('no track to choose without tracks', async () => {
    const mock = api({ '/api/tracks': { success: true, data: [] }, '/api/cars': { success: false } })
    const setTrackId = vi.fn()
    const { result } = renderHook(() => useFreeSessionReferences(null, setTrackId))
    await waitFor(() => expect(result.current.drivers).toEqual(['d']))
    expect(mock).toHaveBeenCalledTimes(3)
    expect(result.current.tracks).toEqual([])
    expect(result.current.cars).toEqual([])
    expect(setTrackId).not.toHaveBeenCalled()
  })
})

describe('useTrackStandings', () => {
  const standingsOf = (id) => ({ success: true, data: { practice: [{ id, lapTime: 1 }] } })

  test('empty without a track', () => {
    const mock = routeFetch({})
    const { result } = renderHook(() => useTrackStandings(null))
    expect(result.current.standings).toEqual({ practice: [], qualif: [], race: [], balancing: [] })
    expect(mock).not.toHaveBeenCalled()
  })

  test("the track's standings, read again for another track", async () => {
    routeFetch({ '/api/records/track/t1': standingsOf('a'), '/api/records/track/t2': standingsOf('b') })
    const { result, rerender } = renderHook(({ id }) => useTrackStandings(id), { initialProps: { id: 't1' } })
    await waitFor(() => expect(result.current.standings.practice[0]?.id).toBe('a'))
    rerender({ id: 't2' })
    await waitFor(() => expect(result.current.standings.practice[0]?.id).toBe('b'))
  })

  test('read again when a session finishes, not after unmounting', async () => {
    const mock = routeFetch({ '/api/records/track/t1': standingsOf('a') })
    const { result, unmount } = renderHook(() => useTrackStandings('t1'))
    await waitFor(() => expect(result.current.standings.practice).toHaveLength(1))
    mock.mockClear()
    await act(async () => window.dispatchEvent(new Event('session:finished')))
    expect(mock).toHaveBeenCalledOnce()
    unmount()
    window.dispatchEvent(new Event('session:finished'))
    expect(mock).toHaveBeenCalledOnce()
  })

  test('kept when they cannot be read again', async () => {
    let reply = standingsOf('a')
    routeFetch({ '/api/records/track/t1': () => reply })
    const { result } = renderHook(() => useTrackStandings('t1'))
    await waitFor(() => expect(result.current.standings.practice).toHaveLength(1))
    reply = { success: false }
    await act(() => result.current.reload())
    expect(result.current.standings.practice).toHaveLength(1)
  })
})
