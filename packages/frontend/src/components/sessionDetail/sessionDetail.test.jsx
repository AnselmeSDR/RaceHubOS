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
  test('the podium of a finished session, with how it ended', () => {
    render(<SessionPodiumCard session={{ ...finishedRace, finishingAt: '2026-03-01T14:35:00Z' }} />)
    expect(received.Podium).toEqual({
      drivers: finishedRace.drivers,
      sessionType: SessionType.RACE,
      stats: { duration: 300, maxDuration: 300000, maxLaps: 20, gracePeriod: 30000, gracePeriodUsed: true },
    })
  })

  test('no duration when it never started', () => {
    render(<SessionPodiumCard session={{ ...finishedRace, startedAt: null }} />)
    expect(received.Podium.stats).toMatchObject({ duration: null, gracePeriodUsed: false })
  })

  test.each([
    ['an unfinished session', { status: SessionStatus.ACTIVE }],
    ['a balancing session', { type: SessionType.BALANCING }],
    ['a session without drivers', { drivers: [] }],
  ])('none for %s', (_, change) => {
    const { container } = render(<SessionPodiumCard session={{ ...finishedRace, ...change }} />)
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
  const session = {
    ...finishedRace,
    laps: [
      { id: 'l1', controller: 0, lapNumber: 1, lapTime: 7000 },
      { id: 'l2', controller: 5, lapNumber: 1, lapTime: 9000 },
    ],
  }

  test('every lap with its driver and car, the fastest highlighted', () => {
    render(<SessionLapHistory session={session} />)
    expect(screen.getByText('Lap history (2)')).toBeInTheDocument()
    const [, first, second] = screen.getAllByRole('row')
    expect(first).toHaveClass('bg-purple-500/10')
    expect(within(first).getByText('Ana')).toBeInTheDocument()
    expect(within(first).getByText('A')).toHaveStyle({ backgroundColor: '#FF0000' })
    expect(first).toHaveTextContent('Ferrari 499P')
    // A lap of an unknown controller
    expect(second).not.toHaveClass('bg-purple-500/10')
    expect(within(second).getByText('Ctrl 6')).toBeInTheDocument()
    expect(within(second).getByText('?')).toHaveStyle({ backgroundColor: '#6B7280' })
  })

  test('none without laps, nor for a balancing session', () => {
    const { container, rerender } = render(<SessionLapHistory session={{ ...finishedRace, laps: [] }} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<SessionLapHistory session={{ ...session, type: SessionType.BALANCING }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
