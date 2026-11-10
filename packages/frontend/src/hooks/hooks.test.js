import { act, renderHook } from '@testing-library/react'
import * as hooks from '.'
import { useNow } from './useNow'
import { useWindowEvents } from './useWindowEvents'

test('the hooks add-ons import from @/hooks', () => {
  const names = ['useFetch', 'useFetchAll', 'useServerSocket', 'useNow', 'useWindowEvents', 'usePagedList']
  for (const name of [...names, 'useDataFreshness', 'useEntityForm']) expect(hooks[name]).toBeTypeOf('function')
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

test('useWindowEvents: each listed window event to the handler of the moment, none after unmount', () => {
  const first = vi.fn()
  const second = vi.fn()
  const events = ['session:finished', 'session:status_changed']
  const { rerender, unmount } = renderHook(({ onEvent }) => useWindowEvents(events, onEvent), {
    initialProps: { onEvent: first },
  })
  window.dispatchEvent(new Event('session:finished'))
  window.dispatchEvent(new Event('other'))
  expect(first).toHaveBeenCalledTimes(1)
  expect(first.mock.calls[0][0].type).toBe('session:finished')
  rerender({ onEvent: second })
  window.dispatchEvent(new Event('session:status_changed'))
  expect(second).toHaveBeenCalledTimes(1)
  unmount()
  window.dispatchEvent(new Event('session:finished'))
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})
