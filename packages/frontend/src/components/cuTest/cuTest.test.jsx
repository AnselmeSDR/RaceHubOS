import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import Test from '@/pages/Test'
import ControllerConfigPanel from './ControllerConfigPanel'
import CuControls from './CuControls'
import CuTestHeader from './CuTestHeader'
import TestLeaderboardPanel from './TestLeaderboardPanel'
import TestLogPanel from './TestLogPanel'
import * as api from './cuTestApi'
import {
  autoAssignControllers,
  controllerInfo,
  cuInfoLines,
  filterLogs,
  formatSeconds,
  groupLogs,
  logColor,
  logEntry,
  modesOf,
  raceStateOf,
  recordLap,
  sortTestLeaderboard,
  sourceBadge,
} from './cuTestModel'
import { CU_TEST_EVENTS, useCuTestSocket } from './useCuTestSocket'

const socket = vi.hoisted(() => ({
  id: 'sock-1',
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  onevent() {},
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key)
const drivers = [
  { id: 'd1', name: 'Ana', number: 7, color: '#111' },
  { id: 'd2', name: 'Ben', number: 9 },
]
const cars = [{ id: 'k1', brand: 'Ferrari', model: '499P', color: '#f00' }]
const emit = (event, data) => act(() => socket.handlers[event](data))

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  socket.handlers = {}
  socket.onevent = vi.fn()
  socket.disconnect = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('model', () => {
  test('log colors and source badges, a default for the rest', () => {
    expect(logColor('error')).toBe('text-red-400')
    expect(logColor('info')).toBe('text-gray-300')
    expect(sourceBadge('BLE')).toBe('bg-blue-600')
    expect(sourceBadge('OTHER')).toBe('bg-gray-600')
  })

  test('a log line, filtered by kind or source, grouped by kind', () => {
    const lap = logEntry('lap', 'BLE', 'Car 1', { lapTime: 1 })
    const info = logEntry('info', 'APP', 'Hello')
    expect(lap).toMatchObject({ type: 'lap', source: 'BLE', message: 'Car 1', data: { lapTime: 1 } })
    expect(info.data).toBeNull()
    expect(new Date(info.timestamp).getTime()).not.toBeNaN()
    expect(filterLogs([lap, info], 'all')).toEqual([lap, info])
    expect(filterLogs([lap, info], 'lap')).toEqual([lap])
    expect(filterLogs([lap, info], 'app')).toEqual([info])
    expect(groupLogs([lap, info, lap])).toEqual({ lap: [lap, lap], info: [info] })
  })

  test('times in seconds, a dash without one', () => {
    expect(formatSeconds(8123)).toBe('8.123s')
    expect(formatSeconds(null)).toBe('-')
  })

  test('drivers on controllers 1 to 8 with the car of the same rank, unless configured', () => {
    expect(autoAssignControllers(drivers, cars, {})).toEqual({
      1: { driverId: 'd1', carId: 'k1' },
      2: { driverId: 'd2', carId: null },
    })
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}` }))
    expect(Object.keys(autoAssignControllers(many, [], {}))).toHaveLength(8)
    const configured = { 3: { driverId: 'd2' } }
    expect(autoAssignControllers(drivers, cars, configured)).toBe(configured)
  })

  test('laps add up per controller: count, last, best, total', () => {
    let board = recordLap({}, { controller: 1, lapTime: 9000 }, 100)
    board = recordLap(board, { controller: 1, time: 8500 }, 200)
    board = recordLap(board, { controller: 1, lapTime: 9100, lapNumber: 7 }, 300)
    expect(board[1]).toEqual({
      controller: 1,
      laps: 7,
      lastLap: 9100,
      bestLap: 8500,
      totalTime: 26600,
      lastUpdate: 300,
    })
    expect(Object.keys(recordLap({}, { carId: 'c9', lapTime: 1 }))).toEqual(['c9'])
    expect(Object.keys(recordLap({}, { lapTime: 1 }))).toEqual(['unknown'])
  })

  test('most laps first, then best lap; no lap time last', () => {
    const board = {
      a: { controller: 'a', laps: 3, bestLap: 9000 },
      b: { controller: 'b', laps: 4, bestLap: 9500 },
      c: { controller: 'c', laps: 3, bestLap: 8000 },
      d: { controller: 'd', laps: 3, bestLap: null },
      e: { controller: 'e', laps: 3, bestLap: null },
    }
    expect(sortTestLeaderboard(board).map((e) => e.controller)).toEqual(['b', 'c', 'a', 'd', 'e'])
    expect(sortTestLeaderboard({ d: board.d, a: board.a }).map((e) => e.controller)).toEqual(['a', 'd'])
  })

  test('who drives on a controller: configured, named in the config, or by default', () => {
    const config = {
      1: { driverId: 'd1', carId: 'k1' },
      2: { driverId: 'd1' },
      3: { driverName: 'Zoe', carName: 'Kart', color: '#abc' },
    }
    expect(controllerInfo(1, config, drivers, cars, t)).toEqual({
      driverName: 'Ana',
      carName: 'Ferrari 499P',
      color: '#f00',
    })
    expect(controllerInfo(2, config, drivers, cars, t).color).toBe('#111')
    expect(controllerInfo(3, config, drivers, cars, t)).toEqual({ driverName: 'Zoe', carName: 'Kart', color: '#abc' })
    expect(controllerInfo(4, config, drivers, cars, t)).toEqual({
      driverName: 'leaderboard.defaultDriver {"number":4}',
      carName: 'leaderboard.defaultCar {"number":4}',
      color: '#0066ff',
    })
    expect(controllerInfo(12, {}, [], [], t).color).toBe('#888')
  })

  test('start lights as the Control Unit reports them', () => {
    const states = [null, { start: 0 }, { start: 3 }, { start: 6 }, { start: 7 }, { start: 9 }, { start: -1 }]
    expect(states.map((s) => raceStateOf(s, t))).toEqual([
      { text: 'raceState.unknown', color: 'gray' },
      { text: 'raceState.racing', color: 'green' },
      { text: 'raceState.lights {"count":3}', color: 'yellow' },
      { text: 'raceState.falseStart', color: 'red' },
      { text: 'raceState.go', color: 'green' },
      { text: 'raceState.stopped', color: 'red' },
      { text: 'raceState.state {"state":-1}', color: 'gray' },
    ])
  })

  test('the modes the Control Unit has on', () => {
    expect(modesOf(null, t)).toEqual([])
    expect(modesOf({ mode: 0b1111 }, t)).toEqual(['modes.fuel', 'modes.real', 'modes.pitLane', 'modes.lapCounter'])
    expect(modesOf({ mode: 0b0100 }, t)).toEqual(['modes.pitLane'])
  })

  test("the Control Unit's info, one line each", () => {
    expect(cuInfoLines({ version: '5337' })).toEqual(['CU Version: 5337'])
    expect(
      cuInfoLines({
        version: '5337',
        ble: { name: 'CU', address: 'aa', uuid: 'u', rssi: -60, manufacturerData: 'm', services: ['s1', 's2'] },
      })
    ).toEqual([
      'CU Version: 5337',
      'BLE Name: CU | Addr: aa | UUID: u',
      'RSSI: -60dBm',
      'Manufacturer: m',
      'Services: s1, s2',
    ])
    expect(cuInfoLines({ version: '1', ble: { name: 'CU', services: [] } })).toHaveLength(2)
  })
})

describe('api', () => {
  test('the latest free practice session, loaded into the sync service', async () => {
    const mock = routeFetch({
      '/api/sessions?': {
        success: true,
        data: [
          { id: 'old', createdAt: '2026-01-01' },
          { id: 'new', createdAt: '2026-02-01' },
        ],
      },
      'POST /api/sync': { success: true },
    })
    expect(await api.ensureTestSession()).toEqual({ id: 'new', createdAt: '2026-02-01' })
    expect(mock).toHaveBeenCalledWith('/api/sessions?type=practice&championshipId=null')
    expect(mock).toHaveBeenLastCalledWith('/api/sync/load-session/new', { method: 'POST' })
  })

  test('created when there is none; nothing loaded when refused', async () => {
    const mock = routeFetch({
      '/api/sessions?': { success: true, data: [] },
      'POST /api/sessions': { success: true, data: { id: 's9' } },
      'POST /api/sync': { success: true },
    })
    expect(await api.ensureTestSession()).toEqual({ id: 's9' })
    const create = mock.mock.calls.find(([url, init]) => url === '/api/sessions' && init?.method === 'POST')
    expect(JSON.parse(create[1].body)).toEqual({ type: SessionType.PRACTICE, name: 'Test Session' })
    const refused = routeFetch({ '/api/sessions?': { success: false }, 'POST /api/sessions': { success: false } })
    expect(await api.ensureTestSession()).toBeNull()
    expect(refused.mock.calls.some(([url]) => url.includes('/sync/'))).toBe(false)
  })

  test('drivers, cars, and the Control Unit', async () => {
    const mock = routeFetch({
      '/api/drivers': { data: drivers },
      '/api/cars': {},
      '/api/bluetooth/status': { connected: true },
      '/api/bluetooth/info': { success: true },
      'POST /api/bluetooth': { success: true },
    })
    expect(await api.loadDriversAndCars()).toEqual({ drivers, cars: [] })
    expect(await api.getBluetoothStatus()).toEqual({ connected: true })
    expect(await api.getBluetoothInfo()).toEqual({ success: true })
    await api.callBluetooth('/esc')
    expect(mock).toHaveBeenLastCalledWith('/api/bluetooth/esc', { method: 'POST', headers: expect.any(Object) })
    await api.callBluetooth('/scan', { autoConnect: true })
    expect(mock.mock.calls.at(-1)[1].body).toBe('{"autoConnect":true}')
  })
})

describe('useCuTestSocket', () => {
  test('known events go to their handler, the others to onUnknown; the socket closes on leave', () => {
    const handlers = { connect: vi.fn(), onUnknown: vi.fn() }
    const dispatch = socket.onevent
    const { unmount } = renderHook(() => useCuTestSocket(handlers))
    expect(Object.keys(socket.handlers)).toEqual(CU_TEST_EVENTS)
    act(() => socket.handlers.connect())
    expect(handlers.connect).toHaveBeenCalledWith(undefined, socket)
    // No handler for it
    act(() => socket.handlers['race:status']({}))
    socket.onevent({ data: ['mystery', { a: 1 }] })
    socket.onevent({ data: ['cu:status', {}] })
    expect(handlers.onUnknown).toHaveBeenCalledTimes(1)
    expect(handlers.onUnknown).toHaveBeenCalledWith('mystery', { a: 1 })
    expect(dispatch).toHaveBeenCalledTimes(2)
    unmount()
    expect(socket.disconnect).toHaveBeenCalled()
  })

  test('without onUnknown, an unknown event is only dispatched', () => {
    const dispatch = socket.onevent
    renderHook(() => useCuTestSocket({}))
    socket.onevent({ data: ['mystery'] })
    expect(dispatch).toHaveBeenCalled()
  })
})

describe('CuTestHeader', () => {
  test('everything off', () => {
    render(<CuTestHeader connected={false} cuConnected={false} cuStatus={null} testSession={null} />)
    expect(screen.getByText('Socket Off')).toBeInTheDocument()
    expect(screen.getByText('CU Offline')).toBeInTheDocument()
    expect(screen.getByText('No Session')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  test('connected, racing, with its modes and session', () => {
    render(
      <CuTestHeader connected cuConnected cuStatus={{ start: 0, mode: 0b0011 }} testSession={{ id: 'abcdefghij' }} />
    )
    expect(screen.getByText('Socket OK')).toBeInTheDocument()
    expect(screen.getByText('CU Connected')).toBeInTheDocument()
    expect(screen.getByText('Racing')).toBeInTheDocument()
    expect(screen.getByText('Session: abcdefgh')).toBeInTheDocument()
    expect(screen.getByText('Fuel')).toBeInTheDocument()
    expect(screen.getByText('Real')).toBeInTheDocument()
  })
})

describe('CuControls', () => {
  const controls = (props = {}) => {
    const handlers = {
      onScan: vi.fn(),
      onCommand: vi.fn(),
      onInfo: vi.fn(),
      onDisconnect: vi.fn(),
      onToggleConfig: vi.fn(),
    }
    render(<CuControls cuConnected={false} cuStatus={null} {...handlers} {...props} />)
    return handlers
  }

  test('offline, only the scan; the config toggle', async () => {
    const { onScan, onToggleConfig } = controls()
    await userEvent.click(screen.getByRole('button', { name: 'Scan & Connect' }))
    expect(onScan).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'START' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Config' }))
    expect(onToggleConfig).toHaveBeenCalled()
    cleanup()
    controls({ scanning: true, showConfig: true })
    expect(screen.getByRole('button', { name: 'Scan & Connect' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Config' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('connected, each command; stop while racing', async () => {
    const { onCommand, onInfo, onDisconnect } = controls({
      cuConnected: true,
      cuStatus: { start: 1, display: 4, fuel: [15, 14, 13, 12, 11, 10] },
    })
    expect(screen.getByText('Display: 4 cars')).toBeInTheDocument()
    expect(screen.getByText('Fuel: [15, 14, 13, 12]')).toBeInTheDocument()
    for (const [name, endpoint] of [
      ['START', '/start-race'],
      ['ESC', '/esc'],
      ['Reset Timer', '/reset-timer'],
      ['Clear Pos', '/clear-position'],
    ]) {
      await userEvent.click(screen.getAllByRole('button', { name })[0])
      expect(onCommand).toHaveBeenLastCalledWith(endpoint)
    }
    await userEvent.click(screen.getByTitle('Button 5: SPEED'))
    expect(onCommand).toHaveBeenLastCalledWith('/button/5')
    await userEvent.click(screen.getByRole('button', { name: 'Info' }))
    expect(onInfo).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(onDisconnect).toHaveBeenCalled()
    cleanup()
    const racing = controls({ cuConnected: true, cuStatus: { start: 0 }, busy: '/esc' })
    expect(screen.getByRole('button', { name: 'STOP' })).toBeDisabled()
    expect(screen.getByText('Display: 6 cars')).toBeInTheDocument()
    expect(racing.onCommand).not.toHaveBeenCalled()
  })

  test('the race can be stopped', async () => {
    const { onCommand } = controls({ cuConnected: true, cuStatus: { start: 0 } })
    await userEvent.click(screen.getByRole('button', { name: 'STOP' }))
    expect(onCommand).toHaveBeenCalledWith('/start-race')
  })
})

describe('ControllerConfigPanel', () => {
  test('a driver and a car per controller', async () => {
    const onChange = vi.fn()
    render(
      <ControllerConfigPanel config={{ 1: { driverId: 'd1' } }} drivers={drivers} cars={cars} onChange={onChange} />
    )
    expect(screen.getByRole('combobox', { name: 'Controller 1 -- Driver --' })).toHaveValue('d1')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Controller 2 -- Driver --' }), 'd2')
    expect(onChange).toHaveBeenCalledWith(2, 'driverId', 'd2')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Controller 8 -- Car --' }), 'k1')
    expect(onChange).toHaveBeenCalledWith(8, 'carId', 'k1')
    expect(screen.getByText(/2 drivers, 1 cars available/)).toBeInTheDocument()
    expect(screen.getAllByRole('option', { name: '#7 Ana' })).toHaveLength(8)
  })
})

describe('TestLogPanel', () => {
  const logs = [logEntry('lap', 'BLE', 'Car 1 Finish', { lapTime: 1 }), logEntry('info', 'APP', 'Hello')]

  test('waiting, then the lines in order, filtered', async () => {
    const { rerender } = render(<TestLogPanel logs={[]} onClear={vi.fn()} />)
    expect(screen.getByText('Waiting for events...')).toBeInTheDocument()
    rerender(<TestLogPanel logs={logs} onClear={vi.fn()} />)
    expect(screen.getAllByTestId('cu-test-log')).toHaveLength(2)
    expect(screen.getByText('(2)')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Logs' }), 'lap')
    expect(screen.getAllByTestId('cu-test-log')).toHaveLength(1)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Logs' }), 'error')
    expect(screen.getByText('Waiting for events...')).toBeInTheDocument()
  })

  test('grouped by kind; data sent to the console; cleared', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const onClear = vi.fn()
    render(<TestLogPanel logs={[...logs, logs[0]]} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Chrono' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('cu-test-log-group').map((g) => g.firstChild.textContent)).toEqual([
      'lap (2)',
      'info (1)',
    ])
    await userEvent.click(screen.getAllByTitle('Log data to console')[0])
    expect(log).toHaveBeenCalledWith({ lapTime: 1 })
    await userEvent.click(screen.getByTitle('Clear logs'))
    expect(onClear).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Grouped' }))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

describe('TestLeaderboardPanel', () => {
  test('no lap yet, then the cars with their laps; a recent one highlighted', async () => {
    const infoOf = (controller) => ({ driverName: `Driver ${controller}`, carName: 'Kart', color: '#000' })
    const onClear = vi.fn()
    const { rerender } = render(<TestLeaderboardPanel entries={[]} infoOf={infoOf} onClear={onClear} />)
    expect(screen.getByText('No lap data yet')).toBeInTheDocument()
    const entries = [
      { controller: 1, laps: 4, bestLap: 8100, lastLap: 8200, lastUpdate: Date.now() },
      { controller: 2, laps: 3, bestLap: null, lastLap: null, lastUpdate: 0 },
    ]
    rerender(<TestLeaderboardPanel entries={entries} infoOf={infoOf} onClear={onClear} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('1Driver 1Kart48.100s8.200s')
    expect(rows[0].className).toContain('bg-yellow-50')
    expect(rows[1]).toHaveTextContent('2Driver 2Kart3--')
    expect(rows[1].className).not.toContain('bg-yellow-50')
    expect(screen.getByText('Total Laps: 7')).toBeInTheDocument()
    expect(screen.getByText('Cars: 2')).toBeInTheDocument()
    await userEvent.click(screen.getByTitle('Clear leaderboard'))
    expect(onClear).toHaveBeenCalled()
  })

  test('the highlight fades with time', () => {
    vi.useFakeTimers()
    const infoOf = () => ({ driverName: 'A', carName: 'B', color: '#000' })
    render(
      <TestLeaderboardPanel
        entries={[{ controller: 1, laps: 1, lastUpdate: Date.now() }]}
        infoOf={infoOf}
        onClear={vi.fn()}
      />
    )
    expect(screen.getAllByRole('row')[1].className).toContain('bg-yellow-50')
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getAllByRole('row')[1].className).not.toContain('bg-yellow-50')
  })
})

describe('Test page', () => {
  function api(overrides = {}) {
    return routeFetch({
      '/api/sessions?': { success: true, data: [{ id: 'session-123456', createdAt: '2026-01-01' }] },
      'POST /api/sync': { success: true },
      '/api/drivers': { data: drivers },
      '/api/cars': { data: cars },
      '/api/bluetooth/status': { connected: false },
      'POST /api/bluetooth': { success: true, message: 'Done' },
      '/api/bluetooth/info': { success: true, data: { version: '5337' } },
      ...overrides,
    })
  }

  const logLines = () => screen.getAllByTestId('cu-test-log').map((l) => l.children[2].textContent)

  test('opens with its session, its drivers on the controllers and the socket events', async () => {
    api()
    render(<Test />)
    expect(await screen.findByText('Session: session-')).toBeInTheDocument()
    expect(logLines()).toEqual(['Page Test initialized', 'Test session loaded: session-...'])
    await userEvent.click(screen.getByRole('button', { name: 'Config' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Controller 1 -- Driver --' })).toHaveValue('d1'))
    expect(screen.getByRole('combobox', { name: 'Controller 1 -- Car --' })).toHaveValue('k1')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Controller 2 -- Car --' }), 'k1')

    act(() => socket.handlers.connect())
    expect(screen.getByText('Socket OK')).toBeInTheDocument()
    emit('lap:completed', { controller: 2, lapTime: 9000 })
    emit('lap_completed', { controller: 2, lapTime: 8800 })
    emit('cu:timer', { isFinishLine: true, controller: 1, lapTime: 9100 })
    emit('cu:timer', { isFinishLine: true, controller: 1, lapTime: 0 })
    emit('cu:timer', { isFinishLine: false, controller: 1, sector: 2 })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => r.children[1].textContent)).toEqual(['BenFerrari 499P', 'AnaFerrari 499P'])
    expect(logLines()).toEqual(
      expect.arrayContaining([
        'Connected (id: sock-1)',
        'Lap completed - Car 2',
        'Lap completed (alt) - Car 2',
        'Car 1 Finish - Lap: 9.100s',
        'Car 1 Finish (first pass)',
        'Car 1 Sector 2',
      ])
    )
    await userEvent.click(screen.getByTitle('Clear leaderboard'))
    expect(screen.getByText('No lap data yet')).toBeInTheDocument()
  })

  test('every server event is logged, the unknown ones too', async () => {
    api()
    render(<Test />)
    await screen.findByText('Session: session-')
    await userEvent.click(screen.getByTitle('Clear logs'))
    emit('connect_error', { message: 'refused' })
    emit('race:status', { active: true })
    emit('race:status', { active: false })
    emit('cu:connected')
    emit('cu:status', { start: 3, mode: 0 })
    expect(screen.getByText('Lights 3/5')).toBeInTheDocument()
    emit('cu:disconnected')
    expect(screen.getByText('CU Offline')).toBeInTheDocument()
    emit('cu:reconnect-failed')
    emit('session:started', { sessionId: 's1' })
    emit('session:stopped', { sessionId: 's1' })
    emit('phase:started', { phase: 'grid' })
    emit('positions:updated', [])
    emit('disconnect', 'transport close')
    act(() => socket.onevent({ data: ['mystery:event', { x: 1 }] }))
    expect(logLines()).toEqual([
      'Connection error: refused',
      'Status: RUNNING',
      'Status: STOPPED',
      'Control Unit connected',
      'Control Unit disconnected',
      'Reconnection failed',
      'Session started: s1',
      'Session stopped: s1',
      'Phase started: grid',
      'Positions updated',
      'Disconnected: transport close',
      'Event: mystery:event',
    ])
  })

  test('scan, commands, info and disconnect, each logged', async () => {
    const mock = api({ '/api/bluetooth/status': { connected: false, lastStatus: null } })
    render(<Test />)
    await screen.findByText('Session: session-')
    await userEvent.click(screen.getByTitle('Clear logs'))
    await userEvent.click(screen.getByRole('button', { name: 'Scan & Connect' }))
    expect(await screen.findByText('CU Connected')).toBeInTheDocument()
    expect(mock).toHaveBeenCalledWith('/api/bluetooth/scan', expect.objectContaining({ body: '{"autoConnect":true}' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'ESC' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Info' }))
    await waitFor(() => expect(logLines()).toContain('CU Version: 5337'))
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(await screen.findByText('CU Offline')).toBeInTheDocument()
    expect(logLines()).toEqual(['Scanning for Control Unit...', 'Done', 'Done', 'CU Version: 5337', 'Done'])
  })

  test('refused or failed commands are logged as errors', async () => {
    api({
      'POST /api/bluetooth/scan': { success: false, error: 'No CU' },
      '/api/bluetooth/status': { connected: true, lastStatus: { start: 9 } },
      'POST /api/bluetooth/esc': new Error('offline'),
      'POST /api/bluetooth/reset-timer': { success: true },
      '/api/bluetooth/info': { success: false, error: 'Busy' },
    })
    render(<Test />)
    expect(await screen.findByText('Stopped')).toBeInTheDocument()
    await userEvent.click(screen.getByTitle('Clear logs'))
    await userEvent.click(screen.getAllByRole('button', { name: 'ESC' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Reset Timer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Info' }))
    await waitFor(() => expect(logLines()).toHaveLength(3))
    expect(logLines()).toEqual(['/esc error: offline', '/reset-timer OK', 'Info failed: Busy'])
  })

  test('a scan that finds nothing; info unreachable', async () => {
    api({ 'POST /api/bluetooth/scan': { success: false, error: 'No CU' } })
    render(<Test />)
    await screen.findByText('Session: session-')
    await userEvent.click(screen.getByTitle('Clear logs'))
    await userEvent.click(screen.getByRole('button', { name: 'Scan & Connect' }))
    await waitFor(() => expect(logLines()).toEqual(['Scanning for Control Unit...', '/scan failed: No CU']))
    expect(screen.getByText('CU Offline')).toBeInTheDocument()
    cleanup()
    api({ '/api/bluetooth/status': { connected: true }, '/api/bluetooth/info': new Error('offline') })
    render(<Test />)
    await userEvent.click(await screen.findByRole('button', { name: 'Info' }))
    await waitFor(() => expect(logLines()).toContain('Info failed: offline'))
  })

  test('no session, no drivers, no Control Unit: the page still opens', async () => {
    api({
      '/api/sessions?': new Error('offline'),
      '/api/drivers': new Error('offline'),
      '/api/bluetooth/status': new Error('offline'),
    })
    render(<Test />)
    await waitFor(() => expect(logLines()).toContain('Failed to load test session: offline'))
    expect(screen.getByText('No Session')).toBeInTheDocument()
    cleanup()
    api({ '/api/sessions?': { success: false }, 'POST /api/sessions': { success: false }, '/api/drivers': {} })
    render(<Test />)
    await userEvent.click(screen.getByRole('button', { name: 'Config' }))
    expect(screen.getByRole('combobox', { name: 'Controller 1 -- Driver --' })).toHaveValue('')
    expect(logLines()).toEqual(['Page Test initialized'])
  })

  test('the Control Unit status is polled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const mock = api()
    render(<Test />)
    await act(() => vi.advanceTimersByTimeAsync(4100))
    expect(mock.mock.calls.filter(([url]) => url === '/api/bluetooth/status')).toHaveLength(3)
  })
})
