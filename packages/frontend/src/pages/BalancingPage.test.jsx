import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import BalancingPage from './BalancingPage'

const { received, spy, app, context, device, navigate } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => ({
    default: (props) => {
      received[name] = props
      return <div data-testid={name} />
    },
  })
  return { received, spy, app: {}, context: {}, device: {}, navigate: vi.fn() }
})
vi.mock('@/components/championship/SessionSection', () => spy('SessionSection'))
vi.mock('@/components/balancing/BalancingChart', () => spy('BalancingChart'))
vi.mock('@/components/balancing/BalancingStandings', () => spy('BalancingStandings'))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => context }))
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => device }))
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => navigate }))

const MAX_LAP_TIME_KEY = 'racehubos-balancing-maxlaptime'
const tracks = [
  { id: 't1', name: 'Monza' },
  { id: 't2', name: 'Spa' },
]
const lineUp = [{ id: 'sd1', controller: 0, driverId: null, carId: 'c1', car: {} }]
const draft = { id: 's1', type: SessionType.BALANCING, status: SessionStatus.DRAFT, drivers: lineUp }

let fetchMock
const calls = (method, path) =>
  fetchMock.mock.calls
    .filter(([url, init]) => (init?.method || 'GET') === method && url.startsWith(path))
    .map(([url, init]) => [url, init?.body && JSON.parse(init.body)])

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
  localStorage.clear()
  navigate.mockReset()
  Object.assign(app, {
    showStandings: true,
    toggleStandings: vi.fn(),
    balancingTrack: 't1',
    setBalancingTrack: vi.fn(),
  })
  Object.assign(device, { startRace: vi.fn() })
  const ok = vi.fn(async () => ({ success: true }))
  Object.assign(context, {
    session: draft,
    entries: [{ id: 'e1' }],
    maxLapsCompleted: 0,
    findOrCreateFreeSession: vi.fn(async () => draft),
    createSession: vi.fn(async () => ({ success: true, data: { id: 'new' } })),
    loadSession: vi.fn(async () => {}),
    startSession: ok,
    pauseSession: ok,
    resumeSession: ok,
    stopSession: ok,
    resetSession: ok,
  })
  fetchMock = routeFetch({
    '/api/tracks': { success: true, data: tracks },
    '/api/drivers/reference': { success: true, data: { id: 'ref' } },
    '/api/drivers': { success: true, data: ['d'] },
    '/api/cars': { success: true, data: ['c'] },
    '/api/records/track/t1': { success: true, data: { practice: [{ id: 'p' }], balancing: [{ id: 'b1' }] } },
    'PUT /api/sessions': { success: true },
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function opened() {
  render(<BalancingPage />)
  await screen.findByTestId('SessionSection')
  await waitFor(() => expect(received.SessionSection.cars).toEqual(['c']))
  await waitFor(() => expect(received.BalancingStandings.standings).toEqual([{ id: 'b1' }]))
}
const newSessionButton = () => screen.getByRole('button', { name: 'New session' })

describe('the track', () => {
  test('the balancing session of the chosen track opens, with a spinner meanwhile', async () => {
    let open
    context.findOrCreateFreeSession = vi.fn(() => new Promise((resolve) => (open = resolve)))
    render(<BalancingPage />)
    expect(screen.queryByTestId('SessionSection')).not.toBeInTheDocument()
    await act(async () => open(draft))
    expect(context.findOrCreateFreeSession).toHaveBeenCalledWith({ trackId: 't1', type: SessionType.BALANCING })
    expect(context.loadSession).toHaveBeenCalledWith('s1')
    expect(screen.getByTestId('SessionSection')).toBeInTheDocument()
  })

  test('none chosen yet: the first one is', async () => {
    app.balancingTrack = null
    render(<BalancingPage />)
    await waitFor(() => expect(app.setBalancingTrack).toHaveBeenCalledWith('t1'))
    expect(context.findOrCreateFreeSession).not.toHaveBeenCalled()
    expect(newSessionButton()).toBeDisabled()
  })

  test('another track can be picked', async () => {
    const user = userEvent.setup()
    await opened()
    expect(screen.getByRole('combobox')).toHaveTextContent('Monza')
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Spa' }))
    expect(app.setBalancingTrack).toHaveBeenCalledWith('t2')
  })

  test("a session without cars takes the previous session's", async () => {
    context.findOrCreateFreeSession = vi.fn(async () => ({ id: 'empty', drivers: [] }))
    render(<BalancingPage />)
    await waitFor(() => expect(context.loadSession).toHaveBeenCalledWith('empty'))
    expect(calls('PUT', '/api/sessions')).toEqual([
      ['/api/sessions/empty/drivers', { drivers: [{ controller: 0, driverId: null, carId: 'c1' }] }],
    ])
  })

  test('a failed opening is logged and ends the spinner', async () => {
    context.findOrCreateFreeSession = vi.fn(async () => {
      throw new Error('offline')
    })
    render(<BalancingPage />)
    await screen.findByTestId('SessionSection')
    expect(console.error).toHaveBeenCalledWith('Error loading session:', expect.any(Error))
  })
})

describe('the reference driver', () => {
  test('none set: a warning leads to the settings', async () => {
    fetchMock = routeFetch({ '/api/drivers/reference': { success: true, data: null } })
    render(<BalancingPage />)
    await screen.findByText('No reference driver')
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(navigate).toHaveBeenCalledWith('/settings')
  })

  test('set, or unknown, no warning', async () => {
    await opened()
    expect(screen.queryByText('No reference driver')).not.toBeInTheDocument()
    cleanup()
    fetchMock = routeFetch({ '/api/drivers/reference': new Error('offline') })
    render(<BalancingPage />)
    await screen.findByTestId('SessionSection')
    expect(screen.queryByText('No reference driver')).not.toBeInTheDocument()
  })
})

describe('the session', () => {
  test('the panel gets the drivers, cars and controls of the open session', async () => {
    await opened()
    expect(received.SessionSection).toMatchObject({ session: draft, sessions: [], drivers: ['d'], cars: ['c'] })
    expect(received.SessionSection.onTriggerCuStart).toBe(device.startRace)
    await act(() => received.SessionSection.onStart())
    await act(() => received.SessionSection.onPause())
    await act(() => received.SessionSection.onResume())
    for (const action of ['startSession', 'pauseSession', 'resumeSession']) {
      expect(context[action]).toHaveBeenCalledWith('s1')
    }
  })

  test('finishing or resetting it reads the standings again', async () => {
    await opened()
    const reads = () => calls('GET', '/api/records/track/t1').length
    const before = reads()
    await act(() => received.SessionSection.onStop())
    expect(context.stopSession).toHaveBeenCalledWith('s1')
    expect(reads()).toBe(before + 1)
    await act(() => received.SessionSection.onReset('s1'))
    expect(context.resetSession).toHaveBeenCalledWith('s1')
    expect(reads()).toBe(before + 2)

    context.resetSession.mockResolvedValueOnce({ success: false })
    await act(() => received.SessionSection.onReset('s1'))
    expect(reads()).toBe(before + 2)

    // A session can finish by itself
    await act(async () => window.dispatchEvent(new Event('session:finished')))
    await waitFor(() => expect(reads()).toBe(before + 3))
  })

  test('without an open session, the controls do nothing', async () => {
    context.session = null
    await opened()
    await act(() => received.SessionSection.onStart())
    await act(() => received.SessionSection.onPause())
    await act(() => received.SessionSection.onStop())
    await act(() => received.SessionSection.onSaveConfig({ maxLaps: 3 }))
    expect(context.startSession).not.toHaveBeenCalled()
    expect(context.stopSession).not.toHaveBeenCalled()
    expect(calls('PUT', '/api/sessions')).toEqual([])
  })

  test('its settings and cars are saved to it alone, then it is read again', async () => {
    await opened()
    const drivers = [{ controller: 2, driverId: null, carId: 'c2', gridPos: null }]
    await act(() => received.SessionSection.onSaveConfig({ maxLaps: 20, drivers }))
    expect(calls('PUT', '/api/sessions')).toEqual([
      ['/api/sessions/s1', { maxLaps: 20 }],
      ['/api/sessions/s1/drivers', { drivers }],
    ])
    // The free sessions' line-up is not touched
    expect(calls('GET', '/api/sessions?')).toEqual([])
    expect(context.loadSession).toHaveBeenLastCalledWith('s1')

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await act(() => received.SessionSection.onSaveConfig({ name: 'x' }))
    expect(console.error).toHaveBeenCalledWith('Error saving session config:', expect.any(Error))
  })

  test('the slowest lap time kept is remembered', async () => {
    localStorage.setItem(MAX_LAP_TIME_KEY, '9500')
    await opened()
    expect(received.SessionSection.maxLapTime).toBe(9500)
    act(() => received.SessionSection.onMaxLapTimeChange(8000))
    expect(received.SessionSection.maxLapTime).toBe(8000)
    expect(localStorage.getItem(MAX_LAP_TIME_KEY)).toBe('8000')
    act(() => received.SessionSection.onMaxLapTimeChange(null))
    expect(received.SessionSection.maxLapTime).toBeNull()
    expect(localStorage.getItem(MAX_LAP_TIME_KEY)).toBeNull()
  })

  test('the chart once a lap is done, with the lap time filter', async () => {
    await opened()
    expect(screen.queryByTestId('BalancingChart')).not.toBeInTheDocument()
    cleanup()
    context.maxLapsCompleted = 1
    localStorage.setItem(MAX_LAP_TIME_KEY, '9000')
    await opened()
    expect(received.BalancingChart).toEqual({ entries: [{ id: 'e1' }], maxLapTime: 9000 })
  })
})

describe('a new session', () => {
  test('a draft with the settings and cars of the current one', async () => {
    const user = userEvent.setup()
    context.session = { ...draft, maxDuration: 600000, maxLaps: 30, gracePeriod: 20000 }
    await opened()
    await user.click(newSessionButton())
    expect(context.createSession).toHaveBeenCalledWith({
      trackId: 't1',
      type: SessionType.BALANCING,
      name: 'Balancing',
      status: SessionStatus.DRAFT,
      maxDuration: 600000,
      maxLaps: 30,
      gracePeriod: 20000,
    })
    expect(calls('PUT', '/api/sessions/new')).toEqual([
      ['/api/sessions/new/drivers', { drivers: [{ controller: 0, driverId: null, carId: 'c1' }] }],
    ])
    expect(context.loadSession).toHaveBeenLastCalledWith('new')
  })

  test('none while a balancing session runs', async () => {
    context.session = { ...draft, status: SessionStatus.PAUSED }
    await opened()
    expect(newSessionButton()).toBeDisabled()
  })

  test('a failure is logged', async () => {
    const user = userEvent.setup()
    context.createSession = vi.fn(async () => {
      throw new Error('offline')
    })
    await opened()
    await user.click(newSessionButton())
    expect(console.error).toHaveBeenCalledWith('Error creating session:', expect.any(Error))
    expect(newSessionButton()).toBeEnabled()
  })
})

describe('the standings', () => {
  test('beside the session, hidden on demand', async () => {
    await opened()
    expect(screen.getByText('Overall Standings')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Hide standings'))
    expect(app.toggleStandings).toHaveBeenCalled()
    cleanup()
    app.showStandings = false
    render(<BalancingPage />)
    await screen.findByTestId('SessionSection')
    expect(screen.queryByTestId('BalancingStandings')).not.toBeInTheDocument()
    expect(screen.getByTitle('Show standings')).toBeInTheDocument()
  })

  test('unreadable, the ones shown stay', async () => {
    await opened()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await act(() => received.SessionSection.onStop())
    expect(console.error).toHaveBeenCalledWith('Error fetching standings:', expect.any(Error))
    expect(received.BalancingStandings.standings).toEqual([{ id: 'b1' }])
  })
})
