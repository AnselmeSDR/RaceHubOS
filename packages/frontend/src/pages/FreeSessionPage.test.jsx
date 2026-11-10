import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import FreeSessionPage from './FreeSessionPage'

const { received, spy, app, context, device } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => ({
    default: (props) => {
      received[name] = props
      return <div data-testid={name} />
    },
  })
  return { received, spy, app: {}, context: {}, device: {} }
})
vi.mock('@/components/freeSession/FreeSessionToolbar', () => spy('FreeSessionToolbar'))
vi.mock('@/components/championship/SessionSection', () => spy('SessionSection'))
vi.mock('@/components/championship/StandingsTabs', () => spy('StandingsTabs'))
vi.mock('@/components/race/SessionLeaderboard', () => spy('SessionLeaderboard'))
vi.mock('@/components/race/StartingGrid', () => spy('StartingGrid'))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => context }))
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => device }))

const tracks = [{ id: 't1', name: 'Monza' }]
const session = { id: 's1', type: SessionType.PRACTICE, status: SessionStatus.ACTIVE, drivers: [] }

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
  Object.assign(app, {
    showStandings: true,
    toggleStandings: vi.fn(),
    freeTrack: 't1',
    setFreeTrack: vi.fn(),
    freeType: SessionType.PRACTICE,
    setFreeType: vi.fn(),
  })
  Object.assign(device, { startRace: vi.fn() })
  Object.assign(context, {
    session,
    entries: [{ id: 'e1' }],
    maxLapsCompleted: 2,
    findOrCreateFreeSession: vi.fn(async () => session),
    loadSession: vi.fn(async () => {}),
    startSession: vi.fn(async () => ({ success: true })),
  })
  routeFetch({
    '/api/tracks': { success: true, data: tracks },
    '/api/drivers': { success: true, data: ['d'] },
    '/api/cars': { success: true, data: ['c'] },
    '/api/records/track/t1': { success: true, data: { practice: [{ id: 'r', lapTime: 1 }] } },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function opened() {
  render(<FreeSessionPage />)
  await screen.findByTestId('SessionSection')
  await waitFor(() => expect(received.FreeSessionToolbar.tracks).toEqual(tracks))
}

test('a spinner while the free session opens', async () => {
  let open
  context.findOrCreateFreeSession = vi.fn(() => new Promise((resolve) => (open = resolve)))
  render(<FreeSessionPage />)
  expect(screen.queryByTestId('SessionSection')).not.toBeInTheDocument()
  expect(received.FreeSessionToolbar.newSessionDisabled).toBe(true)
  await act(async () => open(session))
  expect(screen.getByTestId('SessionSection')).toBeInTheDocument()
})

test('the toolbar drives the track, the type and the standings', async () => {
  await opened()
  expect(received.FreeSessionToolbar).toMatchObject({
    trackId: 't1',
    type: SessionType.PRACTICE,
    onTrackChange: app.setFreeTrack,
    onTypeChange: app.setFreeType,
    showStandings: true,
    onToggleStandings: app.toggleStandings,
    // The practice session is running: no new one
    newSessionDisabled: true,
  })
})

test('a new session can be made once the running one is of another type', async () => {
  app.freeType = SessionType.RACE
  await opened()
  expect(received.FreeSessionToolbar.newSessionDisabled).toBe(false)
})

test('the session panel, the leaderboard and the track standings', async () => {
  await opened()
  expect(received.SessionSection).toMatchObject({ session, sessions: [], drivers: ['d'], cars: ['c'] })
  expect(received.SessionSection.onTriggerCuStart).toBe(device.startRace)
  await act(() => received.SessionSection.onStart())
  expect(context.startSession).toHaveBeenCalledWith('s1')
  expect(received.SessionLeaderboard).toMatchObject({ entries: [{ id: 'e1' }], expanded: false, sortBy: 'laps' })
  await waitFor(() => expect(received.StandingsTabs.standings.practice).toHaveLength(1))
  expect(received.StandingsTabs).toMatchObject({
    drivers: ['d'],
    activeTab: SessionType.PRACTICE,
    onTabChange: app.setFreeType,
  })
})

test('the practice sort chosen is kept', async () => {
  await opened()
  act(() => received.SessionLeaderboard.onSortChange('bestLap'))
  expect(received.SessionLeaderboard.sortBy).toBe('bestLap')
})

test('without the standings the leaderboard takes the whole width', async () => {
  app.showStandings = false
  await opened()
  expect(received.SessionLeaderboard.expanded).toBe(true)
  expect(screen.queryByTestId('StandingsTabs')).not.toBeInTheDocument()
})
