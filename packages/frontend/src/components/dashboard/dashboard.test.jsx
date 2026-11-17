import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ChampionshipMode, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch as stubFetch } from '@/test/helpers'
import ActiveSessionBanner from './ActiveSessionBanner'
import DriverLeaderboardCard from './DriverLeaderboardCard'
import CurrentChampionshipCard from './CurrentChampionshipCard'
import DashboardCounts from './DashboardCounts'
import NowCard from './NowCard'
import RecentSessionsCard from './RecentSessionsCard'
import TopLapsCard from './TopLapsCard'
import { formatLap } from './format'

const { session, device } = vi.hoisted(() => ({ session: {}, device: {} }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => session }))
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => device }))

/** Shows where the router is, to check the links and the banner's navigation. */
function Location() {
  const { pathname, state } = useLocation()
  return (
    <span data-testid="location">
      {pathname}
      {state?.create ? ' create' : ''}
    </span>
  )
}

function renderAt(ui) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
      <Location />
    </MemoryRouter>
  )
}

const ana = { id: 1, name: 'Ana', color: '#FF0000' }
const ben = { id: 2, name: 'Ben', img: 'ben.png' }

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('formatLap', () => {
  test('seconds with three decimals, a dash without a time', () => {
    expect(formatLap(12345)).toBe('12.345s')
    expect(formatLap(0)).toBe('-')
    expect(formatLap(undefined)).toBe('-')
  })
})

describe('ActiveSessionBanner', () => {
  test('nothing without a running session', () => {
    Object.assign(session, { session: null, isActive: false })
    renderAt(<ActiveSessionBanner />)
    expect(screen.queryByTestId('dashboard-active-session')).not.toBeInTheDocument()
  })

  test('the running session, leading to the race screen', async () => {
    Object.assign(session, { session: { name: 'GP Monza' }, isActive: true })
    renderAt(<ActiveSessionBanner />)
    expect(screen.getByText('Active session')).toBeInTheDocument()
    expect(screen.getByText('GP Monza')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Join'))
    expect(screen.getByTestId('location')).toHaveTextContent('/race')
  })

  test('a fallback name for an unnamed session', () => {
    Object.assign(session, { session: {}, isActive: true })
    renderAt(<ActiveSessionBanner />)
    expect(screen.getByText('Active race')).toBeInTheDocument()
  })
})

describe('DashboardCounts', () => {
  const counts = () => screen.getAllByRole('link').map((a) => [a.getAttribute('href'), a.textContent])

  test('the counts from count or total on one line, each linking to its page', async () => {
    const mock = stubFetch({
      '/api/drivers': { count: 4 },
      '/api/cars': { total: 1 },
      '/api/tracks': {},
      '/api/sessions?has_championship=true': { count: 12 },
    })
    renderAt(<DashboardCounts />)
    expect(counts()[0]).toEqual(['/drivers', '- Drivers'])
    await waitFor(() => expect(counts()[0]).toEqual(['/drivers', '4 Drivers']))
    expect(counts().slice(1)).toEqual([
      ['/cars', '1 Car'],
      ['/tracks', '0 Tracks'],
      ['/history', '12 Sessions'],
    ])
    expect(mock).toHaveBeenCalledTimes(4)
  })

  test('zero for an endpoint that fails or cannot be reached', async () => {
    stubFetch({ '/api/drivers': 500, '/api/cars': { count: 2 }, '/api/tracks': new Error('offline') })
    renderAt(<DashboardCounts />)
    await waitFor(() => expect(counts()[1]).toEqual(['/cars', '2 Cars']))
    expect(counts().map(([, text]) => text)).toEqual(['0 Drivers', '2 Cars', '0 Tracks', '0 Sessions'])
  })
})

describe('CurrentChampionshipCard', () => {
  const session = (id, type, status, order, drivers = []) => ({
    id,
    name: `Session ${id}`,
    type,
    status,
    order,
    championshipId: 'c1',
    drivers: drivers.map((driver) => ({ driver })),
  })
  const cup = {
    id: 'c1',
    name: 'Winter Cup',
    status: ChampionshipStatus.ACTIVE,
    mode: ChampionshipMode.AUTO,
    track: { name: 'Monza', color: '#00AA00' },
    participants: [{}, {}, {}],
    // Out of order on purpose: the card sorts them
    sessions: [
      session('r1', SessionType.RACE, SessionStatus.DRAFT, 3),
      session('q1', SessionType.QUALIF, SessionStatus.ACTIVE, 1, [ana, ben]),
      session('p1', SessionType.PRACTICE, SessionStatus.FINISHED, 0, [ana]),
      session('q2', SessionType.QUALIF, SessionStatus.DRAFT, 2),
    ],
  }
  const chips = () => screen.getAllByTestId('dashboard-session-chip').map((chip) => chip.textContent)

  test('the championship under way: its sessions in running order, the next one with its drivers, and the way back', async () => {
    const planned = { id: 'c0', name: 'Planned', status: ChampionshipStatus.PLANNED }
    const mock = stubFetch({
      '/api/championships': { success: true, data: [planned, { ...cup, sessions: [] }] },
      '/api/championships/c1': { success: true, data: cup },
    })
    renderAt(<CurrentChampionshipCard />)
    const card = await screen.findByTestId('dashboard-championship')
    expect(await within(card).findByRole('heading', { name: 'Winter Cup' })).toBeInTheDocument()
    // The one that runs wins over the one that is only planned
    expect(mock).not.toHaveBeenCalledWith('/api/championships/c0')
    expect(within(card).getByText('Current championship')).toBeInTheDocument()
    expect(within(card).getByText('Monza · 3 drivers · automatic')).toBeInTheDocument()
    expect(card).toHaveTextContent('1 / 4 sessions')
    // The strip, then the next session again
    expect(chips()).toEqual(['FP1', 'Q1', 'Q2', 'R1', 'Q1'])
    expect(card).toHaveTextContent('Up next')
    expect(within(card).getByRole('img', { name: 'Ben' })).toBeInTheDocument()
    expect(within(card).getByText('2 drivers')).toBeInTheDocument()
    expect(within(card).getByText('All championships →')).toHaveAttribute('href', '/championships')

    await userEvent.click(within(card).getByRole('button', { name: 'Resume' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/championships/c1')
  })

  test('none under way: the last finished one, to open, and the way to a new one', async () => {
    const done = {
      ...cup,
      status: ChampionshipStatus.FINISHED,
      sessions: cup.sessions.map((s) => ({ ...s, status: SessionStatus.FINISHED })),
    }
    stubFetch({
      '/api/championships': { success: true, data: [done] },
      '/api/championships/c1': { success: true, data: done },
    })
    renderAt(<CurrentChampionshipCard />)
    const card = await screen.findByTestId('dashboard-championship')
    expect(await within(card).findByRole('heading', { name: 'Winter Cup' })).toBeInTheDocument()
    expect(within(card).getByText('Last championship')).toBeInTheDocument()
    expect(card).toHaveTextContent('4 / 4 sessions')
    expect(card).not.toHaveTextContent('Up next')
    expect(within(card).getByRole('button', { name: 'Open' })).toBeInTheDocument()

    await userEvent.click(within(card).getByRole('button', { name: 'New championship' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/championships create')
  })

  test('no championship at all: the way to the first one; nothing while the server does not answer', async () => {
    stubFetch({ '/api/championships': { success: true, data: [] } })
    const { unmount } = renderAt(<CurrentChampionshipCard />)
    const card = await screen.findByTestId('dashboard-championship')
    expect(within(card).getByText('No championship yet')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'New championship' })).toBeInTheDocument()
    unmount()

    const mock = stubFetch({ '/api/championships': 500 })
    renderAt(<CurrentChampionshipCard />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('dashboard-championship')).not.toBeInTheDocument()
  })
})

describe('NowCard', () => {
  test('a running session takes the place of the championship', async () => {
    stubFetch({ '/api/championships': { success: true, data: [] } })
    Object.assign(session, { session: { name: 'GP Monza' }, isActive: true })
    const { unmount } = renderAt(<NowCard />)
    expect(screen.getByTestId('dashboard-active-session')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-championship')).not.toBeInTheDocument()
    unmount()

    Object.assign(session, { session: null, isActive: false })
    renderAt(<NowCard />)
    expect(await screen.findByTestId('dashboard-championship')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-active-session')).not.toBeInTheDocument()
  })
})

describe('RecentSessionsCard', () => {
  const finishedAt = '2026-03-14T10:00:00Z'
  const sessions = [
    {
      id: 's1',
      name: 'Sunday race',
      type: SessionType.RACE,
      finishedAt,
      championship: { name: 'Winter Cup' },
      drivers: [
        { finalPos: 2, bestLapTime: 7001, driver: ben },
        { finalPos: 1, bestLapTime: 7200, driver: ana },
        { finalPos: 3, bestLapTime: null, driver: ana },
      ],
    },
    { id: 's2', name: 'Practice', type: SessionType.PRACTICE, updatedAt: finishedAt, championship: null, drivers: [] },
  ]

  test('the last finished sessions: date, kind, name, championship, winner and best lap; a line opens the session', async () => {
    const mock = stubFetch({ '/api/sessions': { success: true, data: sessions } })
    renderAt(<RecentSessionsCard />)
    const card = await screen.findByTestId('dashboard-recent-sessions')
    expect(mock).toHaveBeenCalledWith('/api/sessions?status=finished&limit=6')
    expect(within(card).getByText('History →')).toHaveAttribute('href', '/history')
    const [first, second] = within(card)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href').startsWith('/sessions/'))
    const day = new Date(finishedAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })
    expect([...first.children].map((cell) => cell.textContent)).toEqual([
      day,
      'Race',
      'Sunday race',
      'Winter Cup',
      'AAna',
      '7.001',
    ])
    expect(first).toHaveAttribute('href', '/sessions/s1')
    // Outside a championship, and nobody ranked yet
    expect([...second.children].map((cell) => cell.textContent)).toEqual([
      day,
      'Practice',
      'Practice',
      'Free Mode',
      '',
      '',
    ])
  })

  test.each([{ success: true, data: [] }, 500, new Error('offline')])(
    'nothing without a session (%s)',
    async (reply) => {
      const mock = stubFetch({ '/api/sessions': reply })
      renderAt(<RecentSessionsCard />)
      await waitFor(() => expect(mock).toHaveBeenCalled())
      await Promise.resolve()
      expect(screen.queryByTestId('dashboard-recent-sessions')).not.toBeInTheDocument()
    }
  )
})

describe('DriverLeaderboardCard', () => {
  const stats = [
    { totalRaces: 9, wins: 4, podiums: 6, bestLap: 8123 },
    { totalRaces: 9, wins: 5, podiums: 2, bestLap: 7999 },
    {},
  ]
  const drivers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Driver ${i + 1}`, statistics: stats[i] }))
  const cells = (row) => [...row.children].map((cell) => cell.textContent)
  const golden = (row) =>
    [...row.querySelectorAll('[data-figure]')]
      .filter((c) => c.className.includes('text-yellow-600'))
      .map((c) => c.dataset.figure)

  test('the ten first drivers, each figure in its titled column, linking to their profile; the best of each column in gold', async () => {
    const mock = stubFetch({ '/api/stats/drivers': { success: true, data: drivers } })
    renderAt(<DriverLeaderboardCard />)
    const card = await screen.findByTestId('dashboard-driver-leaderboard')
    expect(mock).toHaveBeenCalledWith('/api/stats/drivers?has_championship=true')
    expect(card).toHaveTextContent('#DriverRacesWinsPodiumsRecord')
    const rows = within(card)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href').startsWith('/drivers/'))
    expect(rows).toHaveLength(10)
    expect(rows[0]).toHaveAttribute('href', '/drivers/1')
    expect(cells(rows[0])).toEqual(['1', 'DDriver 1', '9', '4', '6', '8.123s'])
    expect(cells(rows[1])).toEqual(['2', 'DDriver 2', '9', '5', '2', '7.999s'])
    expect(cells(rows[2])).toEqual(['3', 'DDriver 3', '0', '0', '0', '-'])
    // A tie is golden for both
    expect(golden(rows[0])).toEqual(['totalRaces', 'podiums'])
    expect(golden(rows[1])).toEqual(['totalRaces', 'wins', 'bestLap'])
    expect(golden(rows[2])).toEqual([])
    // The podium reads from the colour of the rank
    expect(rows[0].firstChild).toHaveClass('text-yellow-500')
    expect(rows[3].firstChild).toHaveClass('text-muted-foreground')
    expect(within(card).getByText('Statistics →')).toHaveAttribute('href', '/stats')
    expect(within(card).queryByText('Driver 11')).not.toBeInTheDocument()
  })

  test('nothing without drivers', async () => {
    const mock = stubFetch({ '/api/stats/drivers': { success: true } })
    renderAt(<DriverLeaderboardCard />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('dashboard-driver-leaderboard')).not.toBeInTheDocument()
  })

  test.each([500, new Error('offline')])('nothing when the server fails (%s)', async (reply) => {
    const mock = stubFetch({ '/api/stats/drivers': reply })
    renderAt(<DriverLeaderboardCard />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('dashboard-driver-leaderboard')).not.toBeInTheDocument()
  })
})

describe('TopLapsCard', () => {
  test('the laps with driver, car, track and time, each in its column; the fastest in gold', async () => {
    const mock = stubFetch({
      '/api/stats/laptimes': {
        success: true,
        data: [
          { driver: ana, car: { brand: 'Ferrari', model: '499P' }, track: { name: 'Monza' }, lapTime: 7001 },
          { driver: null, car: null, track: null, lapTime: 7500 },
          { driver: ben, lapTime: 7600 },
          { driver: ana, lapTime: 7700 },
        ],
      },
    })
    renderAt(<TopLapsCard />)
    const card = await screen.findByTestId('dashboard-top-laps')
    expect(mock).toHaveBeenCalledWith(
      '/api/stats/laptimes?limit=10&sortBy=lapTime&sortOrder=asc&unique=true&has_championship=true'
    )
    expect(within(card).getByText('Fastest laps')).toBeInTheDocument()
    expect(card).toHaveTextContent('#DriverCarTrackTime')
    const rows = within(card).getAllByTestId('top-lap')
    expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
      '1',
      'AAna',
      'FFerrari 499P',
      'Monza',
      '7.001s',
    ])
    expect(within(card).getByText('7.001s')).toHaveClass('text-yellow-600')
    expect(within(card).getByText('7.500s')).not.toHaveClass('text-yellow-600')
    expect(within(card).getByText('?')).toBeInTheDocument()
    expect(rows[2].firstChild).toHaveClass('text-orange-500')
    expect(rows[3].firstChild).toHaveClass('text-muted-foreground')
  })

  test('nothing without laps', async () => {
    const mock = stubFetch({ '/api/stats/laptimes': { success: true } })
    renderAt(<TopLapsCard />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('dashboard-top-laps')).not.toBeInTheDocument()
  })

  test.each([500, new Error('offline')])('nothing when the server fails (%s)', async (reply) => {
    const mock = stubFetch({ '/api/stats/laptimes': reply })
    renderAt(<TopLapsCard />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    expect(screen.queryByTestId('dashboard-top-laps')).not.toBeInTheDocument()
  })
})
