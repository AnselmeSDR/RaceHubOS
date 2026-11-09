import { act, renderHook } from '@testing-library/react'
import * as hooks from '.'
import { useNow } from './useNow'

test('the hooks add-ons import from @/hooks', () => {
  const names = ['useFetch', 'useFetchAll', 'useServerSocket', 'useNow', 'useDataFreshness', 'usePagedList']
  for (const name of [...names, 'useEntityForm']) expect(hooks[name]).toBeTypeOf('function')
})

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1000 }))
  afterEach(() => vi.useRealTimers())

  test('the time, refreshed at the chosen pace until unmounted', () => {
    const { result, unmount } = renderHook(() => useNow(500))
    expect(result.current).toBe(1000)
    act(() => vi.advanceTimersByTime(499))
    expect(result.current).toBe(1000)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(1500)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('every second by default', () => {
    const { result } = renderHook(() => useNow())
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(2000)
  })
})
