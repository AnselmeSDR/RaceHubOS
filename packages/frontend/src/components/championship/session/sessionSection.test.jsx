import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import SessionSection from '../SessionSection'

const { device, live, received, spy } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => (props) => {
    received[name] = props
    return <div data-testid={name} />
  }
  return { device: {}, live: {}, received, spy }
})
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => device }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => live }))
vi.mock('@/components/race/Podium', () => ({ default: spy('Podium') }))
vi.mock('@/components/ui', async (original) => ({ ...(await original()), StartLights: spy('StartLights') }))

const drivers = [
  { id: 'd1', name: 'Ana', img: '/uploads/ana.png' },
  { id: 'd2', name: 'Ben' },
  { id: 'd3', name: 'Cid' },
]
const cars = [
  { id: 'c1', brand: 'Ford', model: 'GT' },
  { id: 'c2', brand: 'Porsche', model: '911' },
]
const entry = (controller, driverId, carId, data = {}) => ({
  id: `e${controller}`,
  controller,
  driverId,
  carId,
  ...data,
})
const newSession = (data = {}) => ({
  id: 's1',
  type: SessionType.RACE,
  status: SessionStatus.DRAFT,
  name: null,
  championshipId: 'ch1',
  createdAt: '2026-01-02T00:00:00Z',
  drivers: [entry(0, 'd1', 'c1'), entry(1, 'd2', 'c2')],
  ...data,
})

let props

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
  Object.assign(device, { cuStatus: null, socketConnected: true, connected: true })
  Object.assign(live, {
    elapsed: 0,
    maxLapsCompleted: 0,
    gracePeriodRemaining: null,
    pauseDuration: null,
    totalPauseDuration: 0,
    pauses: [],
    startedAt: null,
    finishingSession: null,
  })
  props = {
    drivers,
    cars,
    onStart: vi.fn(async () => {}),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onTriggerCuStart: vi.fn(),
    onSaveConfig: vi.fn(async () => {}),
    onReset: vi.fn(),
    onMaxLapTimeChange: vi.fn(),
  }
})

const show = (session, extra = {}) => render(<SessionSection {...props} session={session} {...extra} />)
const title = () => screen.getByTestId('session-title').textContent
/** The input under a limit's label (the labels are not tied to their inputs). */
const limit = (label) => screen.getByText(label).parentElement.querySelector('input')
const setLimit = (label, value) => {
  const input = limit(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}
const button = (name) => screen.getByRole('button', { name })
const savedDrivers = () => props.onSaveConfig.mock.calls.at(-1)[0].drivers

test('without a session, asks to pick one', () => {
  show(null)
  expect(screen.getByText('Select a session')).toBeInTheDocument()
})

describe('the header', () => {
  test('numbered by type within the championship, then the name or the type', () => {
    const q1 = newSession({ id: 'q1', type: SessionType.QUALIF, createdAt: '2026-01-01T00:00:00Z' })
    const q2 = newSession({ id: 'q2', type: SessionType.QUALIF, createdAt: '2026-01-03T00:00:00Z' })
    const sessions = [q2, q1, newSession()]
    const { unmount } = show(q2, { sessions })
    expect(title()).toBe('Q2 - Qualifying')
    unmount()

    show({ ...q1, name: 'Heat' }, { sessions })
    expect(title()).toBe('Q1 - Heat')
  })

  test('free practice has no number, balancing no label; outside a championship, no number', () => {
    const { unmount } = show(newSession({ type: SessionType.PRACTICE }))
    expect(title()).toBe('FP - Free Practice')
    unmount()
    const balancing = show(newSession({ type: SessionType.BALANCING }))
    expect(title()).toBe('Balancing')
    balancing.unmount()
    show(newSession(), { sessions: [] })
    expect(title()).toBe('R - Race')
  })

  test.each([
    [SessionStatus.DRAFT, 'Draft'],
    [SessionStatus.ACTIVE, 'Running'],
    [SessionStatus.PAUSED, 'Paused'],
    [SessionStatus.FINISHING, 'Ending session...'],
    [SessionStatus.FINISHED, 'Finished'],
  ])('a %s session is shown %s', (status, label) => {
    show(newSession({ status }))
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('renaming a draft in place', () => {
  const nameSpan = () => within(screen.getByTestId('session-title')).getByText(/Race|Heat/)

  test('the new name, trimmed, is saved on leaving the field', async () => {
    show(newSession())
    fireEvent.click(nameSpan())
    const field = screen.getByTestId('session-title').querySelector('[contenteditable]')
    field.textContent = '  Heat  '
    fireEvent.blur(field)
    expect(props.onSaveConfig).toHaveBeenCalledWith({ name: 'Heat' })
  })

  test('emptied, the name goes and the type shows again; unchanged, nothing is saved', async () => {
    const { rerender } = show(newSession({ name: 'Heat' }))
    fireEvent.click(nameSpan())
    let field = screen.getByTestId('session-title').querySelector('[contenteditable]')
    field.textContent = 'Heat'
    fireEvent.blur(field)
    expect(props.onSaveConfig).not.toHaveBeenCalled()

    rerender(<SessionSection {...props} session={newSession({ name: 'Heat' })} />)
    fireEvent.click(nameSpan())
    field = screen.getByTestId('session-title').querySelector('[contenteditable]')
    field.textContent = '   '
    await act(async () => fireEvent.blur(field))
    expect(props.onSaveConfig).toHaveBeenCalledWith({ name: null })
  })

  test('Enter saves, Escape gives up', async () => {
    show(newSession())
    fireEvent.click(nameSpan())
    let field = screen.getByTestId('session-title').querySelector('[contenteditable]')
    field.textContent = 'Final'
    const blur = vi.spyOn(field, 'blur')
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(blur).toHaveBeenCalled()

    fireEvent.keyDown(field, { key: 'Escape' })
    expect(screen.getByTestId('session-title').querySelector('[contenteditable]')).toBeNull()
    expect(props.onSaveConfig).not.toHaveBeenCalled()
  })

  test('a failed save is reported', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    props.onSaveConfig.mockRejectedValueOnce(new Error('offline'))
    show(newSession())
    fireEvent.click(nameSpan())
    const field = screen.getByTestId('session-title').querySelector('[contenteditable]')
    field.textContent = 'Heat'
    await act(async () => fireEvent.blur(field))
    expect(console.error).toHaveBeenCalledWith('Failed to save name:', expect.any(Error))
  })

  test('a running session keeps its name', () => {
    show(newSession({ status: SessionStatus.ACTIVE }))
    fireEvent.click(nameSpan())
    expect(screen.getByTestId('session-title').querySelector('[contenteditable]')).toBeNull()
  })
})

describe('the controllers of a draft', () => {
  test('six controllers; a driver or a car used elsewhere is not offered', async () => {
    const user = userEvent.setup()
    show(newSession())
    const pickers = screen.getAllByRole('combobox')
    expect(pickers).toHaveLength(12)
    expect(pickers[0]).toHaveTextContent('Ana')
    expect(pickers[3]).toHaveTextContent('Porsche 911')

    await user.click(pickers[4])
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['---', 'Cid'])
    await user.click(screen.getByRole('option', { name: 'Cid' }))
    expect(savedDrivers()).toEqual([
      { controller: 0, driverId: 'd1', carId: 'c1', gridPos: null },
      { controller: 1, driverId: 'd2', carId: 'c2', gridPos: null },
      { controller: 2, driverId: 'd3', carId: null, gridPos: null },
    ])
  })

  test('a car is picked among those left', async () => {
    const user = userEvent.setup()
    show(newSession({ drivers: [entry(0, 'd1', 'c1'), entry(1, 'd2', null)] }))
    await user.click(screen.getAllByRole('combobox')[3])
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['---', 'Porsche 911'])
    await user.click(screen.getByRole('option', { name: 'Porsche 911' }))
    expect(savedDrivers()[1]).toEqual({ controller: 1, driverId: 'd2', carId: 'c2', gridPos: null })
  })

  test('clearing a controller and setting a grid place are saved', async () => {
    const user = userEvent.setup()
    show(newSession())
    await user.click(screen.getAllByRole('combobox')[2])
    await user.click(screen.getByRole('option', { name: '---' }))
    expect(savedDrivers()).toEqual([
      { controller: 0, driverId: 'd1', carId: 'c1', gridPos: null },
      { controller: 1, driverId: null, carId: 'c2', gridPos: null },
    ])

    const grid = screen.getAllByPlaceholderText('-')[0]
    fireEvent.change(grid, { target: { value: '2' } })
    fireEvent.blur(grid)
    expect(savedDrivers()[0]).toEqual({ controller: 0, driverId: 'd1', carId: 'c1', gridPos: 2 })
  })

  test('a half-set controller is pointed out and blocks the start', () => {
    show(newSession({ drivers: [entry(0, 'd1', null), entry(3, null, 'c2')] }))
    expect(screen.getByText('Ctrl 1: driver without car · Ctrl 4: car without driver')).toBeInTheDocument()
    expect(screen.getByText('Incomplete config')).toBeInTheDocument()
    expect(button('Start')).toBeDisabled()
  })

  test('balancing sets cars only', () => {
    show(newSession({ type: SessionType.BALANCING, drivers: [entry(0, null, 'c1')] }))
    expect(screen.getAllByRole('combobox')).toHaveLength(6)
    expect(screen.queryByText('Driver')).not.toBeInTheDocument()
    expect(screen.queryByText('Grid')).not.toBeInTheDocument()
    expect(button('Start')).toBeEnabled()
  })

  test("a championship session can copy the free practice's controllers", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const practice = newSession({
      id: 'fp',
      type: SessionType.PRACTICE,
      drivers: [entry(2, 'd3', 'c1', { gridPos: 1 }), entry(4, null, null)],
    })
    show(newSession({ drivers: [] }), { sessions: [practice] })
    await userEvent.click(button(/Copy from FP/))
    expect(savedDrivers()).toEqual([{ controller: 2, driverId: 'd3', carId: 'c1', gridPos: 1 }])

    props.onSaveConfig.mockRejectedValueOnce(new Error('offline'))
    await userEvent.click(button(/Copy from FP/))
    expect(console.error).toHaveBeenCalledWith('Failed to copy from practice:', expect.any(Error))
  })

  test('no copy for the free practice itself, nor outside a championship', () => {
    const practice = newSession({ id: 'fp', type: SessionType.PRACTICE })
    const { unmount } = show(practice, { sessions: [practice] })
    expect(screen.queryByText(/Copy from FP/)).not.toBeInTheDocument()
    unmount()
    show(newSession({ championshipId: null }), { sessions: [practice] })
    expect(screen.queryByText(/Copy from FP/)).not.toBeInTheDocument()
  })

  test('a failed controller save is reported', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    props.onSaveConfig.mockRejectedValueOnce(new Error('offline'))
    show(newSession())
    const grid = screen.getAllByPlaceholderText('-')[1]
    fireEvent.change(grid, { target: { value: '1' } })
    await act(async () => fireEvent.blur(grid))
    expect(console.error).toHaveBeenCalledWith('Failed to save controller config:', expect.any(Error))
  })
})

describe('the limits of a draft', () => {
  test('duration in minutes, laps, and a grace period of 5 to 300 s', () => {
    show(newSession({ maxDuration: 600000, maxLaps: 20, gracePeriod: 45000 }))
    expect(limit('Duration (min)')).toHaveValue(10)
    expect(limit('Max laps')).toHaveValue(20)
    expect(limit('Grace (sec)')).toHaveValue(45)

    setLimit('Duration (min)', '5')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ maxDuration: 300000 })
    setLimit('Duration (min)', '0')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ maxDuration: null })
    setLimit('Max laps', '12')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ maxLaps: 12 })
    setLimit('Max laps', '')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ maxLaps: null })
    setLimit('Grace (sec)', '2')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ gracePeriod: 5000 })
    setLimit('Grace (sec)', '999')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ gracePeriod: 300000 })
    setLimit('Grace (sec)', '')
    expect(props.onSaveConfig).toHaveBeenLastCalledWith({ gracePeriod: 30000 })
  })

  test('unset, the limits read 0 and the grace period 30 s', () => {
    show(newSession())
    expect(limit('Duration (min)')).toHaveValue(0)
    expect(limit('Max laps')).toHaveValue(0)
    expect(limit('Grace (sec)')).toHaveValue(30)
  })

  test('balancing filters its laps by a maximum time instead of a grace period', () => {
    const { rerender } = show(newSession({ type: SessionType.BALANCING }), { maxLapTime: 9500 })
    expect(screen.queryByText('Grace (sec)')).not.toBeInTheDocument()
    expect(limit('Max time (sec)')).toHaveValue(9.5)
    setLimit('Max time (sec)', '8.25')
    expect(props.onMaxLapTimeChange).toHaveBeenLastCalledWith(8250)
    setLimit('Max time (sec)', '')
    expect(props.onMaxLapTimeChange).toHaveBeenLastCalledWith(null)

    rerender(<SessionSection {...props} session={newSession({ type: SessionType.BALANCING })} />)
    expect(limit('Max time (sec)')).toHaveValue(null)
  })

  test('free practice has no limits; a running session shows no settings', () => {
    const { unmount } = show(newSession({ type: SessionType.PRACTICE }))
    expect(screen.queryByText('Duration (min)')).not.toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(12)
    unmount()
    show(newSession({ status: SessionStatus.ACTIVE }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('an automatic championship', () => {
  test('its running sessions show their drivers', () => {
    show(newSession({ type: SessionType.QUALIF, status: SessionStatus.ACTIVE }), { autoMode: true })
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.getByRole('presentation')).toHaveAttribute('src', '/uploads/ana.png')
  })

  test('its races wait for the qualifying results', () => {
    show(newSession({ drivers: [] }), { autoMode: true })
    expect(screen.getByText('Drivers assigned automatically after qualifications')).toBeInTheDocument()
  })

  test('its free practice stays editable', () => {
    show(newSession({ type: SessionType.PRACTICE, status: SessionStatus.ACTIVE }), { autoMode: true })
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })

  test('a draft already set shows its controllers, not the drivers list', () => {
    show(newSession({ type: SessionType.QUALIF }), { autoMode: true })
    expect(screen.getAllByRole('combobox')).toHaveLength(12)
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    expect(screen.queryByText('Drivers assigned automatically after qualifications')).not.toBeInTheDocument()
  })
})

describe('the progress of a running session', () => {
  test('time with its pauses and what is left; laps against the count', () => {
    const start = Date.now() - 120000
    Object.assign(live, {
      elapsed: 90,
      totalPauseDuration: 30,
      maxLapsCompleted: 4,
      startedAt: new Date(start).toISOString(),
      pauses: [{ start: start + 60000, end: start + 90000 }],
    })
    show(newSession({ status: SessionStatus.ACTIVE, maxDuration: 600000, maxLaps: 10 }))
    expect(screen.getByText(/01:30/)).toHaveTextContent('01:30(+00:30 pause) / 10:00')
    expect(screen.getByText('08:30 remaining')).toBeInTheDocument()
    expect(screen.getByText('4 / 10 laps')).toBeInTheDocument()
    expect(screen.getByText('6 remaining')).toBeInTheDocument()

    // Racing, paused, racing: three segments of the wall-clock time
    const bar = screen.getByText(/01:30/).closest('div').nextSibling
    const widths = [...bar.children].map((segment) => parseFloat(segment.style.width))
    expect(widths).toHaveLength(3)
    expect(widths[0]).toBeCloseTo(50, 0)
    expect(widths[1]).toBeCloseTo(25, 0)
  })

  test('a pause under way runs up to now, nothing after it', () => {
    const start = Date.now() - 60000
    Object.assign(live, {
      elapsed: 40,
      startedAt: new Date(start).toISOString(),
      pauses: [{ start: start + 40000 }],
    })
    show(newSession({ status: SessionStatus.PAUSED }))
    const segments = [...screen.getByText(/00:40/).closest('div').nextSibling.children]
    expect(segments.map((segment) => segment.className.match(/bg-(green|yellow)-500/)[1])).toEqual(['green', 'yellow'])
    expect(parseFloat(segments[1].style.width)).toBeCloseTo(33.3, 0)
  })

  test('no limit: the time and the laps so far', () => {
    Object.assign(live, { elapsed: 45, maxLapsCompleted: 3 })
    show(newSession({ status: SessionStatus.ACTIVE }))
    expect(screen.getByText('00:45')).toBeInTheDocument()
    expect(screen.getByText('3 laps')).toBeInTheDocument()
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
  })

  test('limits reached show in red', () => {
    Object.assign(live, { elapsed: 600, maxLapsCompleted: 10 })
    show(newSession({ status: SessionStatus.ACTIVE, maxDuration: 600000, maxLaps: 10 }))
    expect(screen.getByText('00:00 remaining')).toHaveClass('text-red-600')
    expect(screen.getByText('0 remaining')).toHaveClass('text-red-600')
  })

  test('the checkered flag counts the grace period down', () => {
    Object.assign(live, { gracePeriodRemaining: 12, finishingSession: { gracePeriodMs: 20000 } })
    show(newSession({ status: SessionStatus.FINISHING }))
    expect(screen.getByText('Checkered flag')).toBeInTheDocument()
    expect(screen.getByText('00:12')).toBeInTheDocument()
    expect(screen.getByText('00:12').closest('div').nextSibling.firstChild).toHaveStyle({ width: '60%' })
    expect(screen.getByText('Waiting for session end')).toBeInTheDocument()
  })

  test('the grace period defaults to 30 s', () => {
    Object.assign(live, { gracePeriodRemaining: 15 })
    show(newSession({ status: SessionStatus.FINISHING }))
    expect(screen.getByText('00:15').closest('div').nextSibling.firstChild).toHaveStyle({ width: '50%' })
  })

  test('a draft shows its limits at zero', () => {
    show(newSession({ maxDuration: 600000, maxLaps: 10 }))
    expect(screen.getByText(/00:00/)).toHaveTextContent('00:00 / 10:00')
    expect(screen.getByText('0 / 10 laps')).toBeInTheDocument()
    // Remaining counts only while it runs
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
  })

  test('a draft or a finished session shows no progress', () => {
    const lapCount = /^\d+ (\/ \d+ )?laps$/
    const { unmount } = show(newSession())
    expect(screen.queryByText(lapCount)).not.toBeInTheDocument()
    unmount()
    show(
      newSession({ status: SessionStatus.FINISHED, maxLaps: 10, drivers: [entry(0, 'd1', 'c1', { totalLaps: 12 })] })
    )
    expect(screen.queryByText(lapCount)).not.toBeInTheDocument()
  })
})

describe('a finished session', () => {
  test('its podium, with its drivers, cars and figures', () => {
    show(
      newSession({
        status: SessionStatus.FINISHED,
        startedAt: '2026-01-01T10:00:00Z',
        finishedAt: '2026-01-01T10:05:30Z',
        finishingAt: '2026-01-01T10:05:00Z',
        maxDuration: 300000,
        maxLaps: null,
        gracePeriod: 30000,
      })
    )
    expect(received.Podium.sessionType).toBe(SessionType.RACE)
    expect(received.Podium.drivers.map((d) => [d.driver.name, d.car.model])).toEqual([
      ['Ana', 'GT'],
      ['Ben', '911'],
    ])
    expect(received.Podium.stats).toEqual({
      duration: 330,
      maxDuration: 300000,
      maxLaps: null,
      gracePeriod: 30000,
      gracePeriodUsed: true,
    })
    expect(button('Reset')).toBeInTheDocument()
    fireEvent.click(button('Reset'))
    expect(props.onReset).toHaveBeenCalledWith('s1')
  })

  test('no podium for balancing, nor without drivers; no reset without the action', () => {
    const { unmount } = show(newSession({ type: SessionType.BALANCING, status: SessionStatus.FINISHED }))
    expect(received.Podium).toBeUndefined()
    unmount()
    show(newSession({ status: SessionStatus.FINISHED, drivers: [] }), { onReset: undefined })
    expect(received.Podium).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })
})

describe('the actions', () => {
  test('a draft starts, once a device is connected', async () => {
    let started
    props.onStart.mockImplementation(() => new Promise((resolve) => (started = resolve)))
    show(newSession())
    fireEvent.click(button('Start'))
    expect(await screen.findByText('Starting...')).toBeInTheDocument()
    expect(button('Starting...')).toBeDisabled()
    await act(async () => started())
    expect(button('Start')).toBeEnabled()
    expect(props.onStart).toHaveBeenCalledTimes(1)
  })

  test('without a device, the start waits for one', () => {
    device.connected = false
    show(newSession())
    expect(screen.getByText('Connect a CU')).toBeInTheDocument()
    expect(button('Start')).toBeDisabled()
  })

  test('in the lights, START advances them; Escape cancels the session', () => {
    device.cuStatus = { start: 3 }
    show(newSession({ status: SessionStatus.ACTIVE }))
    expect(screen.getByText('Lights 3/5')).toBeInTheDocument()
    fireEvent.click(button('START'))
    expect(props.onTriggerCuStart).toHaveBeenCalled()
    received.StartLights.onCancel()
    expect(props.onReset).toHaveBeenCalledWith('s1')
  })

  test('racing: pause or finish', () => {
    device.cuStatus = { start: 0 }
    show(newSession({ status: SessionStatus.ACTIVE }))
    expect(screen.getByText('Racing')).toBeInTheDocument()
    fireEvent.click(button('Pause'))
    fireEvent.click(button('Finish'))
    expect(props.onPause).toHaveBeenCalled()
    expect(props.onStop).toHaveBeenCalled()
  })

  test('the CU stopped on its own: resume it', () => {
    device.cuStatus = { start: 9 }
    show(newSession({ status: SessionStatus.ACTIVE }), { onReset: undefined })
    expect(screen.getByText('CU stopped')).toBeInTheDocument()
    fireEvent.click(button('Resume CU'))
    expect(props.onTriggerCuStart).toHaveBeenCalled()
    expect(received.StartLights.onCancel).toBeUndefined()
  })

  test('paused: how long, then resume or finish', () => {
    live.pauseDuration = 65
    show(newSession({ status: SessionStatus.PAUSED }))
    expect(screen.getByText('Pause 01:05')).toBeInTheDocument()
    fireEvent.click(button('Resume'))
    fireEvent.click(button('Finish'))
    expect(props.onResume).toHaveBeenCalled()
    expect(props.onStop).toHaveBeenCalled()
  })

  test('the connection lost: a warning, and no action', () => {
    device.socketConnected = false
    device.cuStatus = { start: 0 }
    show(newSession({ status: SessionStatus.ACTIVE }))
    expect(screen.getByText('Connection lost - Reconnecting...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument()
  })

  test('paused without connection: no resume', () => {
    device.socketConnected = false
    live.pauseDuration = null
    show(newSession({ status: SessionStatus.PAUSED }))
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()
  })
})
