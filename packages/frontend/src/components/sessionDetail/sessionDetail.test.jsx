import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import SessionDetailHeader from './SessionDetailHeader'
import SessionDnfList from './SessionDnfList'
import SessionLapHistory from './SessionLapHistory'
import SessionPodiumCard from './SessionPodiumCard'
import SessionResults from './SessionResults'
import SessionSummary from './SessionSummary'

const { received, spy } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => ({
    default: (props) => {
      received[name] = props
      return <div data-testid={name} />
    },
  })
  return { received, spy }
})
vi.mock('@/components/race/Podium', () => spy('Podium'))
vi.mock('@/components/race/SessionLeaderboard', () => spy('SessionLeaderboard'))
vi.mock('@/components/balancing/BalancingChart', () => spy('BalancingChart'))

const ana = { name: 'Ana', color: '#FF0000' }
const finishedRace = {
  id: 'abcdef1234',
  type: SessionType.RACE,
  status: SessionStatus.FINISHED,
  createdAt: '2026-03-01T14:30:00Z',
  startedAt: '2026-03-01T14:30:00Z',
  finishedAt: '2026-03-01T14:35:00.900Z',
  maxDuration: 300000,
  maxLaps: 20,
  gracePeriod: 30000,
  drivers: [{ id: 'sd1', controller: 0, driver: ana, car: { brand: 'Ferrari', model: '499P' }, bestLapTime: 7000 }],
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
})
afterEach(cleanup)

describe('SessionDetailHeader', () => {
  const header = (session, handlers = {}) =>
    render(
      <MemoryRouter>
        <SessionDetailHeader session={session} onBack={vi.fn()} onDelete={vi.fn()} {...handlers} />
      </MemoryRouter>
    )

  test('name, type, status, track, championship and export', () => {
    header({
      ...finishedRace,
      name: 'Grand Prix',
      track: { id: 't1', name: 'Monza' },
      championship: { id: 'c1', name: 'Winter Cup' },
    })
    expect(screen.getByRole('heading')).toHaveTextContent('Grand Prix')
    expect(screen.getByText('Race')).toBeInTheDocument()
    expect(screen.getByText('Finished')).toBeInTheDocument()
    expect(screen.getByText('Monza').closest('a')).toHaveAttribute('href', '/tracks/t1')
    expect(screen.getByText('Winter Cup').closest('a')).toHaveAttribute('href', '/championships/c1')
    expect(screen.getByText(/· /)).toHaveTextContent('2026')
  })

  test('an unnamed session by its short id, unknown types and statuses as they are', () => {
    header({ ...finishedRace, type: 'mystery', status: 'odd' })
    expect(screen.getByRole('heading')).toHaveTextContent('Session #abcdef12')
    expect(screen.getByText('mystery')).toBeInTheDocument()
    expect(screen.getByText('odd')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('back goes back', async () => {
    const onBack = vi.fn()
    header(finishedRace, { onBack })
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('SessionPodiumCard', () => {
  const ben = { id: 'sd2', controller: 1, driver: { name: 'Ben' }, bestLapTime: 7100 }
  const race = { ...finishedRace, drivers: [...finishedRace.drivers, ben] }

  test('the podium of a finished race of at least two drivers; how it ended is not its business', () => {
    render(<SessionPodiumCard session={race} />)
    expect(received.Podium).toEqual({ drivers: race.drivers, sessionType: SessionType.RACE })
  })

  test.each([
    ['an unfinished race', { status: SessionStatus.ACTIVE }],
    ['a practice', { type: SessionType.PRACTICE }],
    ['a qualifying', { type: SessionType.QUALIF }],
    ['a balancing session', { type: SessionType.BALANCING }],
    ['a race of one driver', { drivers: finishedRace.drivers }],
    ['a race without drivers', { drivers: [] }],
  ])('none for %s', (_, change) => {
    const { container } = render(<SessionPodiumCard session={{ ...race, ...change }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SessionSummary', () => {
  const figures = () => [...screen.getByTestId('session-summary').children].map((figure) => figure.textContent)

  test("the leader's laps, the duration against the limit of a race, the fastest lap and who set it", () => {
    const drivers = [
      { id: 'sd1', driver: ana, totalLaps: 12, bestLapTime: 7100 },
      { id: 'sd2', driver: { name: 'Ben' }, totalLaps: 11, bestLapTime: 7000 },
    ]
    render(<SessionSummary session={{ ...finishedRace, drivers }} />)
    expect(figures()).toEqual(['12Laps', '5:00 / 5:00Duration', '7.000fastest lap, Ben'])
  })

  test('a practice of one driver: no limit beside the duration, nobody to name; only what is known', () => {
    const practice = { ...finishedRace, type: SessionType.PRACTICE }
    const { unmount } = render(
      <SessionSummary
        session={{ ...practice, drivers: [{ id: 'sd1', driver: ana, totalLaps: 1, bestLapTime: 7000 }] }}
      />
    )
    expect(figures()).toEqual(['1Lap', '5:00Duration', '7.000fastest lap'])
    unmount()
    const { container } = render(<SessionSummary session={{ ...practice, startedAt: null, drivers: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

test('the DNF list names who did not finish, by controller when unnamed', () => {
  const { container, rerender } = render(<SessionDnfList entries={[{ isDNF: false, controller: 0 }]} />)
  expect(container).toBeEmptyDOMElement()
  rerender(
    <SessionDnfList
      entries={[
        { isDNF: true, controller: 0, driver: ana },
        { isDNF: false, controller: 1 },
        { isDNF: true, controller: 2 },
      ]}
    />
  )
  expect(screen.getByTestId('session-dnf')).toHaveTextContent('DNF : Ana, Ctrl 3')
})

describe('SessionResults', () => {
  test('the leaderboard of a race in race order', () => {
    const entries = [{ id: 'e' }]
    render(<SessionResults session={finishedRace} entries={entries} />)
    expect(received.SessionLeaderboard).toEqual({
      entries,
      sortBy: 'race',
      sessionType: SessionType.RACE,
      sessionStatus: SessionStatus.FINISHED,
      expanded: true,
    })
  })

  test('other sessions by best lap', () => {
    render(<SessionResults session={{ ...finishedRace, type: SessionType.QUALIF }} entries={[{ id: 'e' }]} />)
    expect(received.SessionLeaderboard.sortBy).toBe('bestLap')
  })

  test('a message without participants', () => {
    render(<SessionResults session={finishedRace} entries={[]} />)
    expect(screen.getByText('No participants')).toBeInTheDocument()
  })

  test('the lap chart of a balancing session', () => {
    const session = {
      type: SessionType.BALANCING,
      laps: [{ controller: 0, lapNumber: 1, lapTime: 8000 }],
      drivers: [{ id: 'a', controller: 0 }],
    }
    render(<SessionResults session={session} entries={[]} />)
    expect(received.BalancingChart.entries[0].laps).toEqual([{ lapNumber: 1, lapTime: 8000 }])
  })

  test('a message for a balancing session without laps', () => {
    render(<SessionResults session={{ type: SessionType.BALANCING, laps: [], drivers: [] }} entries={[]} />)
    expect(screen.getByText('No lap data')).toBeInTheDocument()
    expect(screen.queryByTestId('BalancingChart')).not.toBeInTheDocument()
  })
})

describe('SessionLapHistory', () => {
  const ben = {
    id: 'sd2',
    controller: 1,
    driver: { name: 'Ben BOU' },
    totalLaps: 2,
    totalTime: 15000,
    bestLapTime: 7100,
  }
  const lap = (controller, lapNumber, lapTime) => ({ id: `${controller}-${lapNumber}`, controller, lapNumber, lapTime })
  const session = {
    ...finishedRace,
    // Ben finishes first: his column comes first
    drivers: [{ ...finishedRace.drivers[0], totalLaps: 1, totalTime: 7000 }, ben],
    laps: [lap(0, 1, 7000), lap(1, 1, 7900), lap(1, 2, 7100), lap(5, 1, 9000)],
  }
  const cells = (row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)

  test('a line per lap and a column per driver in finishing order, two drivers compared on the same lap', () => {
    render(<SessionLapHistory session={session} />)
    expect(screen.getByText('Lap history (4)')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Lap', 'BBOU', 'AAna', '?Ctrl 6'])
    const [first, second] = screen.getAllByTestId('lap')
    expect(cells(first)).toEqual(['1', '7.900', '7.000', '9.000'])
    // Ana and the unknown controller ran one lap only
    expect(cells(second)).toEqual(['2', '7.100', '', ''])
    // The driver's mark is the common picture layer, its initial on its colour
    expect(screen.getByText('A').parentElement).toHaveStyle({ backgroundColor: '#FF0000' })
    expect(screen.getByText('?').parentElement).toHaveStyle({ backgroundColor: '#6B7280' })
  })

  test("each driver's best lap in gold, the fastest of the session in purple", () => {
    render(<SessionLapHistory session={session} />)
    expect(screen.getByText('7.000')).toHaveClass('bg-purple-500/20')
    expect(screen.getByText('7.100')).toHaveClass('text-yellow-600')
    expect(screen.getByText('9.000')).toHaveClass('text-yellow-600')
    expect(screen.getByText('7.900')).not.toHaveClass('text-yellow-600', 'bg-purple-500/20')
  })

  test('a single driver: the laps flow in columns, without a driver nor a car repeated, the best in gold', () => {
    const solo = { ...session, drivers: [ben], laps: [lap(1, 1, 7900), lap(1, 2, 7100)] }
    render(<SessionLapHistory session={solo} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('lap').map((line) => line.textContent)).toEqual(['17.900', '27.100'])
    expect(screen.queryByText('BOU')).not.toBeInTheDocument()
    expect(screen.getByText('7.100')).toHaveClass('text-yellow-600')
  })

  test('none without laps, nor for a balancing session', () => {
    const { container, rerender } = render(<SessionLapHistory session={{ ...finishedRace, laps: [] }} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<SessionLapHistory session={{ ...session, type: SessionType.BALANCING }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
