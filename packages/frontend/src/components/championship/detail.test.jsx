import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import ChampionshipBracketPanel from './ChampionshipBracketPanel'
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
vi.mock('@/components/championship/StandingsTabs', () => spy('StandingsTabs'))
vi.mock('@/components/championship/ChampionshipBracket', () => spy('ChampionshipBracket'))

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
})
afterEach(cleanup)

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
