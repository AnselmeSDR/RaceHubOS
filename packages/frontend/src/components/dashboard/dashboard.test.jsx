import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n'
import { jsonReply } from '@/test/helpers'
import ActiveSessionBanner from './ActiveSessionBanner'
import DriverAvatar from './DriverAvatar'
import DriverLeaderboardCard from './DriverLeaderboardCard'
import QuickActions from './QuickActions'
import RecordsCard from './RecordsCard'
import StatCards from './StatCards'
import SystemStatus from './SystemStatus'
import TopLapsCard from './TopLapsCard'
import { formatLap } from './format'

const { session, device } = vi.hoisted(() => ({ session: {}, device: {} }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => session }))
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => device }))

/** Shows where the router is, to check the links and the banner's navigation. */
function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>
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

/** fetch answering each URL starting with a key of `routes` with its body (a 404 otherwise). */
function stubFetch(routes) {
  const mock = vi.fn(async (url) => {
    const key = Object.keys(routes).find((k) => url.startsWith(k))
    if (!key) return jsonReply({}, 404)
    const body = routes[key]
    if (body instanceof Error) throw body
    return typeof body === 'number' ? jsonReply({}, body) : jsonReply(body)
  })
  vi.stubGlobal('fetch', mock)
  return mock
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

describe('DriverAvatar', () => {
  test('the initial on the driver colour, blue by default', () => {
    const { container, rerender } = render(<DriverAvatar driver={ana} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(container.firstChild).toHaveStyle({ backgroundColor: '#FF0000' })
    expect(container.firstChild).toHaveClass('size-8')
    rerender(<DriverAvatar driver={{ name: 'Zoé' }} size="size-12" />)
    expect(container.firstChild).toHaveStyle({ backgroundColor: '#3B82F6' })
    expect(container.firstChild).toHaveClass('size-12')
  })

  test('the picture when there is one', () => {
    const { container } = render(<DriverAvatar driver={ben} />)
    expect(container.querySelector('img').getAttribute('src')).toContain('ben.png')
    expect(screen.queryByText('B')).not.toBeInTheDocument()
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

describe('StatCards', () => {
  const value = (label) => screen.getByText(label).closest('a').querySelector('span')

  test('the counts from count or total, each linking to its page', async () => {
    const mock = stubFetch({
      '/api/drivers': { count: 4 },
      '/api/cars': { total: 7 },
      '/api/tracks': {},
      '/api/sessions?has_championship=true': { count: 12 },
    })
    renderAt(<StatCards />)
    expect(value('Drivers')).toHaveTextContent('-')
    await waitFor(() => expect(value('Drivers')).toHaveTextContent('4'))
    expect(value('Cars')).toHaveTextContent('7')
    expect(value('Tracks')).toHaveTextContent('0')
    expect(value('Sessions')).toHaveTextContent('12')
    expect(mock).toHaveBeenCalledTimes(4)
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/drivers', '/cars', '/tracks', '/history'])
  })

  test('zero for an endpoint that fails', async () => {
    stubFetch({ '/api/drivers': 500, '/api/cars': { count: 2 }, '/api/tracks': { count: 1 }, '/api/sessions': 500 })
    renderAt(<StatCards />)
    await waitFor(() => expect(value('Cars')).toHaveTextContent('2'))
    expect(value('Drivers')).toHaveTextContent('0')
    expect(value('Sessions')).toHaveTextContent('0')
  })

  test('stops loading when the server is unreachable', async () => {
    stubFetch({ '/api/drivers': new Error('offline') })
    renderAt(<StatCards />)
    await waitFor(() => expect(value('Drivers')).toHaveTextContent('0'))
    expect(value('Cars')).toHaveTextContent('0')
  })
})

describe('RecordsCard', () => {
  test('the three records with their holders', async () => {
    const mock = stubFetch({
      '/api/stats/records': {
        success: true,
        data: {
          fastestLap: { driver: ana, time: 9876 },
          mostWins: { driver: ben, count: 5 },
          mostPodiums: { driver: null, count: 8 },
        },
      },
    })
    renderAt(<RecordsCard />)
    const card = await screen.findByTestId('dashboard-records')
    expect(mock).toHaveBeenCalledWith('/api/stats/records?has_championship=true')
    expect(within(card).getByText('All-time records')).toBeInTheDocument()
    expect(within(card).getByText('Fastest lap').closest('.rounded-lg')).toHaveTextContent('Ana9.876s')
    expect(within(card).getByText('Most wins').closest('.rounded-lg')).toHaveTextContent('Ben5')
    expect(within(card).getByText('Most podiums').closest('.rounded-lg')).toHaveTextContent('?8')
  })

  test('only the records that exist', async () => {
    stubFetch({ '/api/stats/records': { success: true, data: { mostWins: { driver: ana, count: 2 } } } })
    renderAt(<RecordsCard />)
    await screen.findByText('Most wins')
    expect(screen.queryByText('Fastest lap')).not.toBeInTheDocument()
    expect(screen.queryByText('Most podiums')).not.toBeInTheDocument()
  })

  test.each([
    ['an unsuccessful answer', { success: false }],
    ['an error status', 500],
    ['an unreachable server', new Error('offline')],
  ])('nothing on %s', async (_, reply) => {
    const mock = stubFetch({ '/api/stats/records': reply })
    renderAt(<RecordsCard />)
    await waitFor(() => expect(mock).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId('dashboard-records')).not.toBeInTheDocument()
  })
})

describe('DriverLeaderboardCard', () => {
  const drivers = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Driver ${i + 1}`,
    statistics: i === 0 ? { totalRaces: 9, wins: 4, podiums: 6, bestLap: 8123 } : i === 1 ? {} : undefined,
  }))

  test('the ten first drivers, podium icons then ranks, each linking to their profile', async () => {
    const mock = stubFetch({ '/api/stats/drivers': { success: true, data: drivers } })
    renderAt(<DriverLeaderboardCard />)
    const card = await screen.findByTestId('dashboard-driver-leaderboard')
    expect(mock).toHaveBeenCalledWith('/api/stats/drivers?has_championship=true')
    const rows = within(card)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href').startsWith('/drivers/'))
    expect(rows).toHaveLength(10)
    expect(rows[0]).toHaveAttribute('href', '/drivers/1')
    expect(rows[0]).toHaveTextContent('9R · 4W · 6P')
    expect(rows[0]).toHaveTextContent('8.123s')
    expect(rows[1]).toHaveTextContent('0R · 0W · 0P')
    expect(rows[2]).toHaveTextContent('0R · 0W · 0P')
    // The podium shows icons, then plain ranks
    expect(rows[0].querySelector('svg')).not.toBeNull()
    expect(rows[2].querySelector('span').querySelector('svg')).not.toBeNull()
    expect(rows[3].querySelector('span')).toHaveTextContent('4')
    expect(rows[3].querySelector('span')).toHaveClass('text-muted-foreground')
    expect(within(card).getByText('See all →')).toHaveAttribute('href', '/stats')
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
  test('the laps with driver, car, track and time', async () => {
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
    expect(within(card).getByText('Ferrari 499P · Monza')).toBeInTheDocument()
    expect(within(card).getByText('7.001s')).toBeInTheDocument()
    expect(within(card).getByText('?')).toBeInTheDocument()
    expect(within(card).getByText('3')).toHaveClass('text-amber-700')
    expect(within(card).getByText('4')).toHaveClass('text-muted-foreground')
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

describe('QuickActions', () => {
  test('race, championships and statistics shortcuts', () => {
    renderAt(<QuickActions />)
    const card = screen.getByTestId('dashboard-quick-actions')
    expect(within(card).getByText('Quick actions')).toBeInTheDocument()
    expect(within(card).getByText('Start a race').closest('a')).toHaveAttribute('href', '/race')
    expect(within(card).getByText('Championships').closest('a')).toHaveAttribute('href', '/championships')
    expect(within(card).getByText('Statistics').closest('a')).toHaveAttribute('href', '/stats')
  })
})

describe('SystemStatus', () => {
  const state = (label) => screen.getByText(label).nextSibling

  test('the WebSocket and the Control Unit follow the device', () => {
    Object.assign(device, { connected: false, socketConnected: true })
    const { rerender } = render(<SystemStatus />)
    expect(state('Backend API')).toHaveTextContent('OK')
    expect(state('WebSocket')).toHaveTextContent('OK')
    expect(state('Control Unit')).toHaveTextContent('Off')
    expect(state('Control Unit').querySelector('div')).toHaveClass('bg-red-500')
    expect(state('Database')).toHaveTextContent('SQLite')

    Object.assign(device, { connected: true, socketConnected: false })
    rerender(<SystemStatus />)
    expect(state('WebSocket')).toHaveTextContent('Off')
    expect(state('Control Unit')).toHaveTextContent('OK')
  })
})
