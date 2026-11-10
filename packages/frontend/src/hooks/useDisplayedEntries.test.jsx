import { renderHook, waitFor } from '@testing-library/react'
import { SessionStatus } from '@racehubos/shared'
import { routeFetch } from '@/test/helpers'
import { useDisplayedEntries } from './useDisplayedEntries'

const { context } = vi.hoisted(() => ({ context: {} }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => context }))

const liveEntries = [{ id: 'live' }]

beforeEach(() => {
  Object.assign(context, { entries: liveEntries, maxLapsCompleted: 7, loadSession: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())

test('nothing without a session', () => {
  const mock = routeFetch({})
  const { result } = renderHook(() => useDisplayedEntries(null))
  expect(result.current).toEqual({ entries: [], maxLaps: 0 })
  expect(mock).not.toHaveBeenCalled()
  expect(context.loadSession).not.toHaveBeenCalled()
})

test('a running session follows the live context', () => {
  const mock = routeFetch({})
  const { result } = renderHook(() => useDisplayedEntries({ id: 's1', status: SessionStatus.PAUSED }))
  expect(context.loadSession).toHaveBeenCalledWith('s1')
  expect(result.current).toEqual({ entries: liveEntries, maxLaps: 7 })
  expect(mock).not.toHaveBeenCalled()
})

test('another session shows its stored leaderboard', async () => {
  routeFetch({
    '/api/sessions/s1/leaderboard': {
      success: true,
      data: [
        { id: 'b', position: 2, totalLaps: 4 },
        { id: 'a', position: 1, totalLaps: 5 },
      ],
    },
  })
  const { result } = renderHook(() => useDisplayedEntries({ id: 's1', status: SessionStatus.FINISHED }))
  expect(result.current).toEqual({ entries: [], maxLaps: 0 })
  await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['a', 'b']))
  expect(result.current.maxLaps).toBe(5)
  expect(context.loadSession).not.toHaveBeenCalled()
})

test("a session's leaderboard isn't shown for the next one", async () => {
  routeFetch({
    '/api/sessions/s1/leaderboard': { success: true, data: [{ id: 'a', position: 1 }] },
    '/api/sessions/s2/leaderboard': () => new Promise(() => {}),
  })
  const { result, rerender } = renderHook(({ session }) => useDisplayedEntries(session), {
    initialProps: { session: { id: 's1', status: SessionStatus.DRAFT } },
  })
  await waitFor(() => expect(result.current.entries).toHaveLength(1))
  rerender({ session: { id: 's2', status: SessionStatus.DRAFT } })
  expect(result.current.entries).toEqual([])
})
