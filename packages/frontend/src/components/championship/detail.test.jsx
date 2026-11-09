import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import ChampionshipBracketPanel from './ChampionshipBracketPanel'
import ChampionshipSessionView from './ChampionshipSessionView'
import ChampionshipStandingsPanel from './ChampionshipStandingsPanel'
import { useStandingsTab } from './useStandingsTab'

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
vi.mock('@/components/race/SessionLeaderboard', () => spy('SessionLeaderboard'))
vi.mock('@/components/race/StartingGrid', () => spy('StartingGrid'))
vi.mock('@/components/championship/StandingsTabs', () => spy('StandingsTabs'))
vi.mock('@/components/championship/ChampionshipBracket', () => spy('ChampionshipBracket'))

const entries = [{ id: 'e1' }]

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
})
afterEach(cleanup)

describe('ChampionshipSessionView', () => {
  test('nothing without a session', () => {
    const { container } = render(<ChampionshipSessionView session={null} entries={[]} maxLaps={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('the starting grid before the first lap', () => {
    render(<ChampionshipSessionView session={{ status: SessionStatus.READY }} entries={entries} maxLaps={0} />)
    expect(received.StartingGrid).toEqual({ entries })
    expect(screen.queryByTestId('SessionLeaderboard')).not.toBeInTheDocument()
  })

  test('the leaderboard of a finished session, even without laps', () => {
    const session = { type: SessionType.RACE, status: SessionStatus.FINISHED }
    render(<ChampionshipSessionView session={session} entries={entries} maxLaps={0} expanded />)
    expect(received.SessionLeaderboard).toEqual({
      entries,
      expanded: true,
      sortBy: 'race',
      onSortChange: undefined,
      sessionType: SessionType.RACE,
      sessionStatus: SessionStatus.FINISHED,
    })
  })

  test('qualifying sorts by best lap', () => {
    const session = { type: SessionType.QUALIF, status: SessionStatus.ACTIVE }
    render(<ChampionshipSessionView session={session} entries={entries} maxLaps={2} expanded={false} />)
    expect(received.SessionLeaderboard).toMatchObject({ sortBy: 'bestLap', expanded: false, onSortChange: undefined })
  })

  test('practice sorts as chosen, the choice kept for the next practice', () => {
    const practice = { id: 'p1', type: SessionType.PRACTICE, status: SessionStatus.ACTIVE }
    const { rerender } = render(<ChampionshipSessionView session={practice} entries={entries} maxLaps={3} />)
    expect(received.SessionLeaderboard.sortBy).toBe('laps')
    act(() => received.SessionLeaderboard.onSortChange('bestLap'))
    expect(received.SessionLeaderboard.sortBy).toBe('bestLap')
    rerender(<ChampionshipSessionView session={{ ...practice, id: 'p2' }} entries={entries} maxLaps={3} />)
    expect(received.SessionLeaderboard.sortBy).toBe('bestLap')
  })
})

test('the standings panel shows its title and hands everything to the tabs', () => {
  const standings = { practice: [], qualif: [], race: [] }
  const onTabChange = vi.fn()
  render(
    <ChampionshipStandingsPanel
      standings={standings}
      drivers={['d']}
      activeTab={SessionType.RACE}
      onTabChange={onTabChange}
    />
  )
  expect(screen.getByText('General Standings')).toBeInTheDocument()
  expect(received.StandingsTabs).toEqual({ standings, drivers: ['d'], activeTab: SessionType.RACE, onTabChange })
})

test('the bracket panel hands the championship and the selection to the bracket', () => {
  const onSessionSelect = vi.fn()
  render(<ChampionshipBracketPanel championshipId="c1" onSessionSelect={onSessionSelect} />)
  expect(screen.getByTestId('championship-bracket')).toContainElement(screen.getByTestId('ChampionshipBracket'))
  expect(received.ChampionshipBracket).toEqual({ championshipId: 'c1', onSessionSelect })
})

describe('useStandingsTab', () => {
  test('practice until a session is selected, then its type', () => {
    const { result, rerender } = renderHook(({ type }) => useStandingsTab(type), { initialProps: {} })
    expect(result.current[0]).toBe(SessionType.PRACTICE)
    rerender({ type: SessionType.QUALIF })
    expect(result.current[0]).toBe(SessionType.QUALIF)
  })

  test('free to change, until the selected session type changes', () => {
    const { result, rerender } = renderHook(({ type }) => useStandingsTab(type), {
      initialProps: { type: SessionType.RACE },
    })
    act(() => result.current[1](SessionType.PRACTICE))
    expect(result.current[0]).toBe(SessionType.PRACTICE)
    rerender({ type: SessionType.RACE })
    expect(result.current[0]).toBe(SessionType.PRACTICE)
    // No session: the tab stays; selecting one again follows its type
    rerender({ type: undefined })
    expect(result.current[0]).toBe(SessionType.PRACTICE)
    rerender({ type: SessionType.RACE })
    expect(result.current[0]).toBe(SessionType.RACE)
  })
})
