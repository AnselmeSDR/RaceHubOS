import { act, renderHook, waitFor } from '@testing-library/react'
import { io } from 'socket.io-client'
import { waitForRestart } from './api'
import { PROGRESS_EVENT, useAddonProgress } from './useAddonProgress'

const socket = vi.hoisted(() => ({
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))
vi.mock('./api', async (original) => ({ ...(await original()), waitForRestart: vi.fn() }))

beforeEach(() => {
  socket.handlers = {}
  socket.disconnect = vi.fn()
  waitForRestart.mockReset()
})

const emit = (payload) => act(() => socket.handlers[PROGRESS_EVENT](payload))

test('follows addons:progress', () => {
  const { result } = renderHook(() => useAddonProgress({ onRestarted: vi.fn() }))
  expect(io).toHaveBeenCalledWith(import.meta.env.VITE_WS_URL || '', { transports: ['websocket', 'polling'] })
  expect(result.current.progress).toBeNull()

  emit({ action: 'install', addon: 'hello', step: 'build', status: 'running' })
  expect(result.current.progress).toEqual({ action: 'install', addon: 'hello', step: 'build', status: 'running' })
})

test('once complete, waits for the restart and then reloads', async () => {
  waitForRestart.mockResolvedValue()
  const onRestarted = vi.fn()
  renderHook(() => useAddonProgress({ onRestarted }))

  emit({ action: 'install', addon: 'hello', step: 'restart', status: 'complete' })
  await waitFor(() => expect(onRestarted).toHaveBeenCalledTimes(1))
  expect(waitForRestart).toHaveBeenCalledTimes(1)
})

test('leaving the page stops listening and never reloads', async () => {
  let restarted
  waitForRestart.mockReturnValue(new Promise((resolve) => (restarted = resolve)))
  const onRestarted = vi.fn()
  const { unmount } = renderHook(() => useAddonProgress({ onRestarted }))
  emit({ action: 'install', addon: 'hello', step: 'restart', status: 'complete' })

  unmount()
  restarted()
  await Promise.resolve()
  expect(socket.disconnect).toHaveBeenCalled()
  expect(onRestarted).not.toHaveBeenCalled()
})

test('reloads the page by default', async () => {
  waitForRestart.mockResolvedValue()
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  try {
    renderHook(() => useAddonProgress())
    emit({ action: 'enable', addon: 'hello', step: 'restart', status: 'complete' })
    await waitFor(() => expect(reload).toHaveBeenCalled())
  } finally {
    vi.unstubAllGlobals()
  }
})
