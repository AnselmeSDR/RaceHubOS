import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import BackendStatusPopup from '../BackendStatusPopup'
import { logLine, socketLog, STATUS_EVENTS, statusItems, statusLogs } from './statusLog'

const socket = vi.hoisted(() => ({
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const t = i18n.getFixedT('en', 'layout')
const emit = (event, data) => act(() => socket.handlers[event](data))
const health = { status: 'ok', version: '1.25.8' }
const cu = { connected: true }
const realDevice = { isMockDevice: false }

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  socket.handlers = {}
  socket.disconnect = vi.fn(() => socket.handlers.disconnect?.('io client disconnect'))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('log lines', () => {
  test('stamped with the time of day', () => {
    expect(logLine('warn', 'hi')).toEqual({
      timestamp: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
      level: 'warn',
      message: 'hi',
    })
  })

  test('each server event in words', () => {
    const lines = [
      socketLog(t, 'connect'),
      socketLog(t, 'disconnect', 'transport close'),
      socketLog(t, 'cu:connected'),
      socketLog(t, 'cu:disconnected'),
      socketLog(t, 'cu:status', { start: 7, mode: 1 }),
      socketLog(t, 'cu:timer', { isFinishLine: true, controller: 2, lapTime: 8123 }),
      socketLog(t, 'cu:timer', { isFinishLine: false, sector: 2, controller: 2, lapTime: 4000 }),
      socketLog(t, 'lap:completed', { driver: { name: 'Ana' }, lapTime: 8123 }),
      socketLog(t, 'lap:completed', { controller: 3, lapTime: 9000 }),
      socketLog(t, 'session:started', { sessionId: 'abcdef123456' }),
      socketLog(t, 'session:stopped', { sessionId: 'abcdef123456' }),
    ]
    expect(lines).toEqual([
      ['info', 'WebSocket connected'],
      ['warn', 'WebSocket disconnected'],
      ['info', 'CU connected'],
      ['warn', 'CU disconnected'],
      ['debug', 'CU Status: Go!, Mode: 1'],
      ['debug', 'Finish: Ctrl 2 - 8123ms'],
      ['debug', 'Sector 2: Ctrl 2 - 4000ms'],
      ['info', 'Lap: Ana - 8.123s'],
      ['info', 'Lap: Ctrl 3 - 9.000s'],
      ['info', 'Session started: abcdef12...'],
      ['info', 'Session stopped: abcdef12...'],
    ])
    expect(STATUS_EVENTS).toHaveLength(lines.length - 2)
  })

  test('the states read: the server, then the simulator or the Control Unit', () => {
    const backend = ['info', 'Backend: ok (v1.25.8)']
    expect(statusLogs(t, { health, bluetooth: cu, simulator: { isMockDevice: true, running: true } })).toEqual([
      backend,
      ['info', 'Simulator mode: Running'],
    ])
    expect(statusLogs(t, { health, bluetooth: cu, simulator: { isMockDevice: true } })[1][1]).toBe(
      'Simulator mode: Stopped'
    )
    expect(statusLogs(t, { health, bluetooth: cu, simulator: realDevice })[1]).toEqual(['info', 'CU connected'])
    expect(statusLogs(t, { health, bluetooth: {}, simulator: realDevice })[1]).toEqual(['warn', 'CU not connected'])
  })

  test('the status cards before anything is read, then for the simulator', () => {
    const summary = (items) => items.map(({ ok, detail }) => [ok, detail])
    expect(summary(statusItems(t, { socketConnected: false }))).toEqual([
      [false, 'Disconnected'],
      [false, 'Disconnected'],
      [false, 'Disconnected'],
    ])
    const simulator = { isMockDevice: true, running: false }
    expect(summary(statusItems(t, { health, bluetooth: cu, simulator, socketConnected: true }))).toEqual([
      [true, 'v1.25.8'],
      [false, 'Stopped'],
      [true, 'Connected'],
    ])
    expect(statusItems(t, { health, simulator: { ...simulator, running: true } })[1]).toMatchObject({
      ok: true,
      detail: 'Running',
    })
  })
})

describe('BackendStatusPopup', () => {
  const routes = (overrides = {}) =>
    routeFetch({ '/health': health, '/api/bluetooth/status': cu, '/api/simulator': realDevice, ...overrides })
  const lines = () => screen.getAllByTestId('log-line').map((line) => line.lastChild.textContent)

  test('closed, it neither reads nor listens', () => {
    const fetch = routes()
    render(<BackendStatusPopup isOpen={false} onClose={() => {}} />)
    expect(fetch).not.toHaveBeenCalled()
    expect(socket.handlers).toEqual({})
  })

  test('open: the states read, the server events logged, filtered and cleared', async () => {
    routes()
    const onClose = vi.fn()
    render(<BackendStatusPopup isOpen onClose={onClose} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    await screen.findByText('Backend: ok (v1.25.8)')
    expect(screen.getByText(/v1\.25\.8 · CU Bluetooth/)).toBeInTheDocument()
    expect(within(screen.getByTestId('status-device')).getByText('Connected')).toBeInTheDocument()
    expect(within(screen.getByTestId('status-socket')).getByText('Disconnected')).toBeInTheDocument()

    emit('connect')
    emit('cu:status', { start: 0, mode: 0 })
    emit('lap:completed', { driver: { name: 'Ana' }, lapTime: 8000 })
    expect(within(screen.getByTestId('status-socket')).getByText('Connected')).toBeInTheDocument()
    expect(lines()).toEqual([
      'Backend: ok (v1.25.8)',
      'CU connected',
      'WebSocket connected',
      'CU Status: Racing, Mode: 0',
      'Lap: Ana - 8.000s',
    ])
    expect(screen.getByText('Logs (5)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'debug' }))
    expect(lines()).toEqual(['CU Status: Racing, Mode: 0'])
    expect(screen.getByRole('button', { name: 'debug' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'error' }))
    expect(screen.getByText('No logs')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'All' }))

    await userEvent.click(screen.getByTitle('Clear'))
    expect(lines()).toEqual(['Logs cleared'])

    emit('disconnect')
    expect(within(screen.getByTestId('status-socket')).getByText('Disconnected')).toBeInTheDocument()
  })

  test('the log follows the newest line only while scrolled to the bottom', async () => {
    routes()
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<BackendStatusPopup isOpen onClose={() => {}} />)
    await screen.findByText('Backend: ok (v1.25.8)')
    const list = screen.getByTestId('status-logs')
    Object.defineProperties(list, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } })

    fireEvent.scroll(list, { target: { scrollTop: 100 } })
    scrollIntoView.mockClear()
    emit('cu:connected')
    expect(scrollIntoView).not.toHaveBeenCalled()

    fireEvent.scroll(list, { target: { scrollTop: 780 } })
    emit('cu:disconnected')
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  test('the simulator, then a server that does not answer; the log kept from one opening to the next', async () => {
    routes({ '/api/simulator': { isMockDevice: true, running: true } })
    const { rerender } = render(<BackendStatusPopup isOpen onClose={() => {}} />)
    await screen.findByText('Simulator mode: Running')
    expect(screen.getByText(/v1\.25\.8 · Simulator/)).toBeInTheDocument()
    emit('connect')

    rerender(<BackendStatusPopup isOpen={false} onClose={() => {}} />)
    expect(socket.disconnect).toHaveBeenCalled()

    routes({ '/health': new Error('Failed to fetch') })
    rerender(<BackendStatusPopup isOpen onClose={() => {}} />)
    await screen.findByText('Backend connection error: Failed to fetch')
    expect(lines()).toEqual([
      'Backend: ok (v1.25.8)',
      'Simulator mode: Running',
      'WebSocket connected',
      'WebSocket disconnected',
      'Backend connection error: Failed to fetch',
    ])
    expect(within(screen.getByTestId('status-backend')).getByText('Disconnected')).toBeInTheDocument()
    expect(within(screen.getByTestId('status-socket')).getByText('Disconnected')).toBeInTheDocument()
    expect(screen.getByText(/\.\.\. · Simulator/)).toBeInTheDocument()
  })

  test('a reading that ends after closing is dropped', async () => {
    const answers = []
    routes({ '/health': () => new Promise((resolve) => answers.push(resolve)) })
    const { rerender } = render(<BackendStatusPopup isOpen onClose={() => {}} />)
    await waitFor(() => expect(answers).toHaveLength(1))
    rerender(<BackendStatusPopup isOpen={false} onClose={() => {}} />)
    await act(async () => answers[0](health))
    rerender(<BackendStatusPopup isOpen onClose={() => {}} />)
    await waitFor(() => expect(answers).toHaveLength(2))
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    await act(async () => answers[1](health))
    expect(lines()).toEqual(['WebSocket disconnected', 'Backend: ok (v1.25.8)', 'CU connected'])
  })
})
