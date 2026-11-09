import { act, cleanup, renderHook } from '@testing-library/react'
import { routeFetch } from '@/test/helpers'
import { useServerSocket } from '@/hooks/useServerSocket'
import { DeviceProvider, useDevice } from '../DeviceContext'
import * as requests from './deviceRequests'

const socket = vi.hoisted(() => ({
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const emit = (event, data) => act(() => socket.handlers[event](data))
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

beforeEach(() => {
  socket.handlers = {}
  socket.disconnect = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useServerSocket', () => {
  test('each event to the handler of the moment; the socket closes on unmount', () => {
    const first = vi.fn()
    const second = vi.fn()
    const events = ['a', 'b']
    const { rerender, unmount } = renderHook(({ onEvent }) => useServerSocket(events, onEvent), {
      initialProps: { onEvent: first },
    })
    act(() => socket.handlers.a(1))
    expect(first).toHaveBeenCalledWith('a', 1)
    rerender({ onEvent: second })
    act(() => socket.handlers.b(2))
    expect(second).toHaveBeenCalledWith('b', 2)
    unmount()
    expect(socket.disconnect).toHaveBeenCalled()
  })
})

describe('requests', () => {
  test('status, devices, scan, connect, disconnect, delete and commands', async () => {
    const mock = routeFetch({ '/api': { success: true } })
    await requests.getStatus()
    await requests.getDevices()
    await requests.scanDevices(5000)
    await requests.connectDevice('AA:BB')
    await requests.disconnectDevice()
    await requests.deleteDevice('dev1')
    await requests.cuCommand('button/5')
    expect(mock.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ['/api/bluetooth/status', undefined, undefined],
      ['/api/devices', undefined, undefined],
      ['/api/bluetooth/scan', 'POST', '{"timeout":5000}'],
      ['/api/bluetooth/connect', 'POST', '{"address":"AA:BB"}'],
      ['/api/bluetooth/disconnect', 'POST', undefined],
      ['/api/devices/dev1', 'DELETE', undefined],
      ['/api/bluetooth/button/5', 'POST', undefined],
    ])
  })
})

describe('DeviceProvider', () => {
  const status = { connected: true, deviceType: 'cu', deviceAddress: 'AA', lastStatus: { start: 0 } }
  const devices = [{ id: 'dev1' }]

  async function provider(routes = {}) {
    const mock = routeFetch({
      '/api/bluetooth/status': status,
      '/api/devices': { success: true, data: devices },
      ...routes,
    })
    const view = renderHook(() => useDevice(), { wrapper: DeviceProvider })
    await settle()
    return { ...view, mock }
  }

  test('useDevice outside a provider fails loudly', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useDevice())).toThrow('useDevice must be used within a DeviceProvider')
  })

  test('opens with the connection and the devices the server knows', async () => {
    const { result } = await provider()
    expect(result.current).toMatchObject({
      connected: true,
      deviceType: 'cu',
      deviceAddress: 'AA',
      cuStatus: { start: 0 },
      devices,
      isRacing: true,
      isInLightsSequence: false,
    })
  })

  test('nothing known yet: disconnected, the Control Unit stopped', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = await provider({ '/api/bluetooth/status': {}, '/api/devices': { success: false } })
    expect(result.current).toMatchObject({ connected: false, deviceType: null, cuStatus: { start: 8 }, devices: [] })
    cleanup()
    const failed = await provider({
      '/api/bluetooth/status': new Error('offline'),
      '/api/devices': new Error('offline'),
    })
    expect(failed.result.current.connected).toBe(false)
    expect(console.error).toHaveBeenCalledTimes(2)
    await provider({ '/api/devices': { success: true } })
  })

  test('the socket and the Control Unit events', async () => {
    const { result } = await provider()
    emit('connect')
    expect(result.current.socketConnected).toBe(true)
    emit('disconnect')
    expect(result.current.socketConnected).toBe(false)
    emit('cu:status', { start: 3 })
    expect(result.current).toMatchObject({ connected: true, isInLightsSequence: true })
    emit('cu:status', { start: 8, connected: false })
    expect(result.current.connected).toBe(false)
    emit('cu:connected')
    expect(result.current.connected).toBe(true)
    emit('cu:timer', { controller: 1 })
    expect(result.current.lastTimer).toEqual({ controller: 1 })
    emit('cu:connection', { status: 'connected', device: { id: 'BB' } })
    expect(result.current).toMatchObject({ connected: true, deviceAddress: 'BB' })
    emit('cu:connection', { status: 'lost' })
    expect(result.current).toMatchObject({ connected: false, deviceAddress: 'BB' })
    emit('cu:disconnected')
    expect(result.current).toMatchObject({ connected: false, deviceType: null, deviceAddress: null })
  })

  test('scanning lists the devices in reach; a refusal or an error lists none', async () => {
    const found = [{ address: 'CC' }]
    const { result } = await provider({ 'POST /api/bluetooth/scan': { success: true, devices: found } })
    await act(async () => expect(await result.current.scan()).toEqual(found))
    expect(result.current).toMatchObject({ scanResults: found, scanning: false })
    routeFetch({ 'POST /api/bluetooth/scan': { success: true } })
    await act(async () => expect(await result.current.scan()).toBeUndefined())
    expect(result.current.scanResults).toEqual([])
    routeFetch({ 'POST /api/bluetooth/scan': { success: false } })
    await act(async () => expect(await result.current.scan()).toEqual([]))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'POST /api/bluetooth/scan': new Error('offline') })
    await act(async () => expect(await result.current.scan()).toEqual([]))
  })

  test('connecting keeps the device, then reloads the list', async () => {
    const { result, mock } = await provider({
      '/api/bluetooth/status': {},
      'POST /api/bluetooth/connect': { success: true, deviceType: 'sim' },
    })
    await act(async () =>
      expect(await result.current.connect('SIMULATOR')).toEqual({ success: true, deviceType: 'sim' })
    )
    expect(result.current).toMatchObject({
      connected: true,
      deviceType: 'sim',
      deviceAddress: 'SIMULATOR',
      connecting: false,
    })
    expect(mock.mock.calls.filter(([url]) => url === '/api/devices')).toHaveLength(2)
  })

  test('a refused or failed connection', async () => {
    const { result } = await provider({
      '/api/bluetooth/status': {},
      'POST /api/bluetooth/connect': { success: false, error: 'Busy' },
    })
    await act(async () => expect(await result.current.connect('CC')).toEqual({ success: false, error: 'Busy' }))
    expect(result.current.connected).toBe(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'POST /api/bluetooth/connect': new Error('offline') })
    await act(async () => expect(await result.current.connect('CC')).toEqual({ success: false, error: 'offline' }))
  })

  test('disconnecting forgets the device; a refusal keeps it', async () => {
    const { result } = await provider({ 'POST /api/bluetooth/disconnect': { success: false } })
    await act(() => result.current.disconnect())
    expect(result.current.connected).toBe(true)
    routeFetch({ 'POST /api/bluetooth/disconnect': { success: true } })
    await act(async () => expect(await result.current.disconnect()).toEqual({ success: true }))
    expect(result.current).toMatchObject({ connected: false, deviceAddress: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'POST /api/bluetooth/disconnect': new Error('offline') })
    await act(async () => expect(await result.current.disconnect()).toEqual({ success: false, error: 'offline' }))
  })

  test('removing a device reloads the list', async () => {
    const { result, mock } = await provider({ 'DELETE /api/devices/dev1': { success: true } })
    await act(() => result.current.removeDevice('dev1'))
    expect(mock.mock.calls.filter(([url, init]) => url === '/api/devices' && !init)).toHaveLength(2)
    routeFetch({ 'DELETE /api/devices/dev1': { success: false } })
    await act(async () => expect(await result.current.removeDevice('dev1')).toEqual({ success: false }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'DELETE /api/devices/dev1': new Error('offline') })
    await act(async () =>
      expect(await result.current.removeDevice('dev1')).toEqual({ success: false, error: 'offline' })
    )
  })

  test("Control Unit commands return the server's answer", async () => {
    const { result, mock } = await provider({ 'POST /api/bluetooth': { success: true } })
    await act(async () => expect(await result.current.startRace()).toEqual({ success: true }))
    await act(() => result.current.pressEsc())
    await act(() => result.current.pressButton(5))
    expect(mock.mock.calls.slice(-3).map(([url]) => url)).toEqual([
      '/api/bluetooth/start-race',
      '/api/bluetooth/esc',
      '/api/bluetooth/button/5',
    ])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'POST /api/bluetooth': new Error('offline') })
    await act(async () => expect(await result.current.pressEsc()).toEqual({ success: false, error: 'offline' }))
  })
})
