import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import StandingsTabs from '../StandingsTabs'
import StandingStats from './StandingStats'
import { gapToLeader, lapCount, raceLaps, raceTime, rankingTime, standingsFor } from './standingsOrder'

const ana = { id: 'd1', name: 'Ana', color: '#e10600', img: '/uploads/ana.png' }
const ben = { id: 'd2', name: 'Ben' }

beforeAll(() => i18n.changeLanguage('en'))
afterEach(cleanup)

describe('order', () => {
  test('fields named either way', () => {
    expect(raceLaps({ raceTotalLaps: 4 })).toBe(4)
    expect(raceLaps({})).toBe(0)
    expect(raceTime({ raceTotalTime: 90 })).toBe(90)
    expect(lapCount({ laps: 3 })).toBe(3)
    expect(rankingTime({ lapTime: 0, bestTime: 9000 }, SessionType.PRACTICE)).toBe(9000)
    expect(rankingTime({ lapTime: 8000, bestTime: 9000 }, SessionType.QUALIF)).toBe(9000)
  })

  test('practice: fastest first, no time last', () => {
    const practice = [{ driverId: 'a' }, { driverId: 'b', bestTime: 9000 }, { driverId: 'c', lapTime: 8000 }]
    expect(standingsFor({ practice }, SessionType.PRACTICE).map((s) => s.driverId)).toEqual(['c', 'b', 'a'])
    expect(standingsFor({}, SessionType.PRACTICE)).toEqual([])
  })

  test('qualifying: only those with a time, fastest first', () => {
    const qualif = [
      { driverId: 'a', bestTime: 9000 },
      { driverId: 'b', bestTime: null },
      { driverId: 'c', bestTime: 8000 },
      { driverId: 'd', bestTime: 0 },
    ]
    expect(standingsFor({ qualif }, SessionType.QUALIF).map((s) => s.driverId)).toEqual(['c', 'a'])
    expect(qualif).toHaveLength(4)
  })

  test('race: those who drove or scored, most laps then shortest time; any other tab reads it', () => {
    const race = [
      { driverId: 'a', totalLaps: 10, totalTime: 100 },
      { driverId: 'b', raceTotalLaps: 10, raceTotalTime: 90 },
      { driverId: 'c', totalLaps: 12 },
      { driverId: 'd', points: 3 },
      { driverId: 'e' },
      { driverId: 'f', totalLaps: 12, totalTime: 120 },
    ]
    expect(standingsFor({ race }, SessionType.RACE).map((s) => s.driverId)).toEqual(['f', 'c', 'b', 'a', 'd'])
    expect(standingsFor({ race }, SessionType.BALANCING)).toHaveLength(5)
    expect(standingsFor({}, SessionType.RACE)).toEqual([])
  })

  test('gaps: time behind, laps behind in a race; none for the leader, without times, or off the tabs', () => {
    const leader = { bestTime: 8000, lapTime: 8000, totalLaps: 10, totalTime: 100000 }
    expect(gapToLeader(leader, leader, SessionType.RACE)).toBeNull()
    expect(gapToLeader({ lapTime: 8500 }, leader, SessionType.PRACTICE)).toEqual({ type: 'time', value: 500 })
    expect(gapToLeader({ bestTime: 9000 }, leader, SessionType.QUALIF)).toEqual({ type: 'time', value: 1000 })
    expect(gapToLeader({}, leader, SessionType.QUALIF)).toBeNull()
    expect(gapToLeader({ totalLaps: 8 }, leader, SessionType.RACE)).toEqual({ type: 'laps', value: 2 })
    expect(gapToLeader({ totalLaps: 10, totalTime: 101500 }, leader, SessionType.RACE)).toEqual({
      type: 'time',
      value: 1500,
    })
    expect(gapToLeader({ totalLaps: 10 }, leader, SessionType.RACE)).toBeNull()
    expect(gapToLeader({ points: 1 }, { points: 2 }, SessionType.RACE)).toBeNull()
    expect(gapToLeader({ bestTime: 9000 }, leader, SessionType.BALANCING)).toBeNull()
  })
})

describe('StandingStats', () => {
  test('nothing off the standard tabs', () => {
    const { container } = render(
      <StandingStats standing={{ bestTime: 1 }} position={1} gap={null} tab={SessionType.BALANCING} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('StandingsTabs', () => {
  const rows = () => screen.getAllByTestId('standing-row')

  test('one tab per session type, the active one selected', async () => {
    const onTabChange = vi.fn()
    render(<StandingsTabs activeTab={SessionType.QUALIF} onTabChange={onTabChange} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.title)).toEqual(['Free Practice', 'Qualifying', 'Race'])
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('No standings available')).toBeInTheDocument()
    await userEvent.click(tabs[2])
    expect(onTabChange).toHaveBeenCalledWith(SessionType.RACE)
  })

  test('practice: drivers by best lap, with their laps and gap; an unknown driver', () => {
    const practice = [
      { driverId: 'd2', lapTime: 8500, laps: 12, car: { brand: 'Porsche', model: '963' } },
      { driverId: 'd1', bestTime: 8000, totalLaps: 0 },
      { driverId: 'zz', lapTime: 9000 },
    ]
    render(<StandingsTabs standings={{ practice }} drivers={[ana, ben]} onTabChange={vi.fn()} />)
    const [first, second, third] = rows()
    expect(within(first).getByAltText('Ana')).toBeInTheDocument()
    expect(first).not.toHaveTextContent('laps')
    expect(second).toHaveTextContent('BenPorsche 963• 12 laps')
    expect(second).toHaveTextContent('+0.500')
    expect(third).toHaveTextContent('Unknown driver')
    expect(third).toHaveTextContent('+1.000')
  })

  test('qualifying: the best time and the gap; the driver given by the standing', () => {
    const qualif = [
      { driverId: 'd1', bestTime: 8000, driver: { name: 'Zed' } },
      { driverId: 'd2', bestTime: 8200 },
    ]
    render(
      <StandingsTabs standings={{ qualif }} drivers={[ana, ben]} activeTab={SessionType.QUALIF} onTabChange={vi.fn()} />
    )
    const [first, second] = rows()
    expect(first).toHaveTextContent('Zed')
    expect(within(first).getByText('Z')).toBeInTheDocument()
    expect(second).toHaveTextContent('+0.200')
  })

  test('race: laps, the total of the leader, the gap of the others, points', () => {
    const race = [
      { driverId: 'd1', totalLaps: 10, totalTime: 100000, points: 25 },
      { driverId: 'd2', totalLaps: 10, totalTime: 101500, points: 18 },
      { driverId: 'd3', raceTotalLaps: 8, raceTotalTime: 90000 },
      { driverId: 'd4', totalLaps: 10 },
    ]
    render(
      <StandingsTabs
        standings={{ race }}
        drivers={[ana, ben, { id: 'd3', name: 'Cid' }, { id: 'd4' }]}
        activeTab={SessionType.RACE}
        onTabChange={vi.fn()}
      />
    )
    // Same laps without a total time: after those with one
    const [first, second, third, fourth] = rows()
    expect(within(first).getByText('Total')).toBeInTheDocument()
    expect(first).toHaveTextContent('25 pts')
    expect(within(second).getByText('Gap')).toBeInTheDocument()
    expect(second).toHaveTextContent('+1.500')
    // No total time: no gap either
    expect(third).toHaveTextContent('Gap')
    expect(within(third).getByText('?')).toBeInTheDocument()
    expect(fourth).toHaveTextContent('+2 laps')
    expect(fourth).not.toHaveTextContent('pts')
  })
})
