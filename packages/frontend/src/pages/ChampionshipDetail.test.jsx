import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ChampionshipMode, SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import ChampionshipDetail from './ChampionshipDetail'

const { received, spy, app, session, device } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => ({
    default: (props) => {
      received[name] = props
      return <div data-testid={name} />
    },
  })
  return { received, spy, app: {}, session: {}, device: {} }
})
vi.mock('@/components/championship/ChampionshipHeader', () => spy('ChampionshipHeader'))
vi.mock('@/components/championship/ChampionshipBracket', () => spy('ChampionshipBracket'))
vi.mock('@/components/championship/ChampionshipResults', () => spy('ChampionshipResults'))
vi.mock('@/components/championship/ChampionshipConfigModal', () => spy('ChampionshipConfigModal'))
vi.mock('@/components/championship/SessionSection', () => spy('SessionSection'))
vi.mock('@/components/championship/StandingsTabs', () => spy('StandingsTabs'))
vi.mock('@/components/race/SessionLeaderboard', () => spy('SessionLeaderboard'))
vi.mock('@/components/race/StartingGrid', () => spy('StartingGrid'))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => session }))
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => device }))

const practice = { id: 's1', type: SessionType.PRACTICE, status: SessionStatus.FINISHED }
const race = { id: 's2', type: SessionType.RACE, status: SessionStatus.ACTIVE }
const drivers = [{ id: 'd1' }, { id: 'd2' }]
let championship

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/championships/c1']}>
      <Routes>
        <Route path="/championships/:id" element={<ChampionshipDetail />} />
        <Route path="/championships" element={<div data-testid="championship-list" />} />
      </Routes>
    </MemoryRouter>
  )
}

async function loaded() {
  const view = renderPage()
  await screen.findByTestId('ChampionshipHeader')
  return view
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
  localStorage.clear()
  championship = { id: 'c1', mode: ChampionshipMode.MANUAL }
  Object.assign(app, { showStandings: true, toggleStandings: vi.fn() })
  Object.assign(device, { startRace: vi.fn() })
  const ok = vi.fn(async () => ({ success: true }))
  Object.assign(session, {
    entries: [{ id: 'live' }],
    maxLapsCompleted: 4,
    loadSession: ok,
    startSession: ok,
    resetSession: ok,
  })
  routeFetch({
    '/api/championships/c1': () => ({ success: true, data: championship }),
    '/api/championships/c1/standings': { standings: [] },
    'DELETE /api/championships/c1': { success: true },
    '/api/sessions?championshipId=c1': { success: true, data: [practice, race] },
    '/api/sessions/s1/leaderboard': { success: true, data: [{ id: 'e1', position: 1, totalLaps: 3 }] },
    '/api/drivers': { success: true, data: drivers },
    '/api/cars': { success: true, data: ['car'] },
    '/api/tracks': { success: true, data: ['track'] },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('a spinner while loading', () => {
  const { container } = renderPage()
  expect(container.querySelector('.animate-spin')).not.toBeNull()
  expect(screen.queryByTestId('ChampionshipHeader')).not.toBeInTheDocument()
})

test('the first session selected, its stored leaderboard and the standings beside it', async () => {
  await loaded()
  expect(received.ChampionshipHeader).toMatchObject({ championship, sessions: [practice, race] })
  expect(received.ChampionshipHeader.selectedSession).toEqual(practice)
  expect(received.SessionSection).toMatchObject({ session: practice, drivers, cars: ['car'], autoMode: false })
  expect(received.SessionSection.onTriggerCuStart).toBe(device.startRace)
  await waitFor(() => expect(received.SessionLeaderboard?.entries).toHaveLength(1))
  expect(received.SessionLeaderboard).toMatchObject({ expanded: false, sortBy: 'laps' })
  expect(received.StandingsTabs).toMatchObject({ drivers, activeTab: SessionType.PRACTICE })
  expect(screen.getByText('General Standings')).toBeInTheDocument()
})

test('selecting a running session follows it live', async () => {
  await loaded()
  act(() => received.ChampionshipHeader.onSelectSession(race))
  expect(received.SessionSection.session).toEqual(race)
  expect(session.loadSession).toHaveBeenCalledWith('s2')
  expect(received.SessionLeaderboard).toMatchObject({ entries: [{ id: 'live' }], sortBy: 'race' })
  expect(received.StandingsTabs.activeTab).toBe(SessionType.RACE)
  expect(localStorage.getItem('championship_c1_session')).toBe('s2')
})

test('without the standings the leaderboard takes the whole width', async () => {
  app.showStandings = false
  await loaded()
  await waitFor(() => expect(received.SessionLeaderboard?.expanded).toBe(true))
  expect(screen.queryByTestId('StandingsTabs')).not.toBeInTheDocument()
  expect(received.ChampionshipHeader.onToggleStandings).toBe(app.toggleStandings)
})

test('the results replace the sessions until a session is selected', async () => {
  await loaded()
  act(() => received.ChampionshipHeader.onSelectResults())
  expect(received.ChampionshipResults).toEqual({ championshipId: 'c1' })
  expect(screen.queryByTestId('SessionSection')).not.toBeInTheDocument()
  expect(received.ChampionshipHeader.showResults).toBe(true)
  act(() => received.ChampionshipHeader.onSelectSession(practice))
  expect(screen.queryByTestId('ChampionshipResults')).not.toBeInTheDocument()
})

describe('the bracket', () => {
  test('only for an automatic championship, its participants only in the sessions', async () => {
    championship = { id: 'c1', mode: ChampionshipMode.AUTO, participants: [{ driverId: 'd2' }] }
    await loaded()
    expect(received.SessionSection).toMatchObject({ autoMode: true, drivers: [{ id: 'd2' }] })
    act(() => received.ChampionshipHeader.onToggleBracket())
    expect(received.ChampionshipBracket.championshipId).toBe('c1')
    expect(received.ChampionshipHeader.showBracket).toBe(true)
    // Picking a session in it selects the session and closes it
    act(() => received.ChampionshipBracket.onSessionSelect('s2'))
    expect(received.SessionSection.session).toEqual(race)
    expect(screen.queryByTestId('ChampionshipBracket')).not.toBeInTheDocument()
  })

  test('hidden for a manual championship', async () => {
    await loaded()
    act(() => received.ChampionshipHeader.onToggleBracket())
    expect(screen.queryByTestId('ChampionshipBracket')).not.toBeInTheDocument()
  })

  test('closed by showing the results', async () => {
    championship = { id: 'c1', mode: ChampionshipMode.AUTO }
    await loaded()
    act(() => received.ChampionshipHeader.onToggleBracket())
    act(() => received.ChampionshipHeader.onSelectResults())
    expect(screen.queryByTestId('ChampionshipBracket')).not.toBeInTheDocument()
  })
})

test('the configuration modal saves and reloads the championship', async () => {
  const mock = fetch
  await loaded()
  expect(screen.queryByTestId('ChampionshipConfigModal')).not.toBeInTheDocument()
  act(() => received.ChampionshipHeader.onConfig())
  expect(received.ChampionshipConfigModal).toMatchObject({
    championship,
    sessions: [practice, race],
    tracks: ['track'],
    drivers,
    open: true,
  })
  expect(received.ChampionshipHeader.showConfig).toBe(true)
  act(() => received.ChampionshipConfigModal.onSave({ id: 'c1', name: 'Renamed' }))
  expect(received.ChampionshipHeader.championship).toEqual({ id: 'c1', name: 'Renamed' })
  mock.mockClear()
  await act(() => received.ChampionshipConfigModal.onSessionsChange())
  const urls = mock.mock.calls.map(([url]) => url)
  expect(urls).toContain('/api/championships/c1')
  expect(urls).toContain('/api/sessions?championshipId=c1')
  expect(urls).toContain('/api/championships/c1/standings?type=race')
  act(() => received.ChampionshipConfigModal.onClose())
  expect(screen.queryByTestId('ChampionshipConfigModal')).not.toBeInTheDocument()
})

test('the session panel acts on the selected session', async () => {
  await loaded()
  await act(() => received.SessionSection.onStart())
  expect(session.startSession).toHaveBeenCalledWith('s1')
  await act(() => received.SessionSection.onReset('s1'))
  expect(session.resetSession).toHaveBeenCalledWith('s1')
})

test('deleting the championship goes back to the list', async () => {
  await loaded()
  await act(() => received.ChampionshipHeader.onDelete())
  expect(fetch).toHaveBeenCalledWith('/api/championships/c1', { method: 'DELETE' })
  expect(screen.getByTestId('championship-list')).toBeInTheDocument()
})

test('finishing the championship from the header', async () => {
  await loaded()
  routeFetch({ 'PUT /api/championships/c1': { data: { id: 'c1', status: SessionStatus.FINISHED } } })
  await act(() => received.ChampionshipHeader.onFinish())
  expect(received.ChampionshipHeader.championship).toEqual({ id: 'c1', status: SessionStatus.FINISHED })
})
