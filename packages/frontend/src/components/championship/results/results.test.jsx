import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import ChampionshipResults from '../ChampionshipResults'
import AwardCard from './AwardCard'
import { formatLapTime, formatTotalTime } from './format'
import ResultsPodium from './ResultsPodium'
import ResultsStandingsTable from './ResultsStandingsTable'

const ana = { name: 'Ana', color: '#FF0000', img: '/api/img/ana.png' }
const ben = { name: 'Ben' }
const cy = { name: 'Cy', color: '#00FF00' }

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('lap and total times', () => {
  expect(formatLapTime(7123)).toBe('7.123s')
  expect(formatLapTime(65432)).toBe('1:05.432')
  expect(formatLapTime(0)).toBe('--')
  expect(formatTotalTime(125500)).toBe('2:05.500')
  expect(formatTotalTime(null)).toBe('--')
})

describe('ResultsPodium', () => {
  const podium = [
    { driverId: 'a', driver: ana, totalLaps: 30 },
    { driverId: 'b', driver: ben, totalLaps: 29 },
    { driverId: 'c', driver: cy, totalLaps: 28 },
  ]

  test('the winner in the middle, second on the left, third on the right', () => {
    const { container } = render(<ResultsPodium podium={podium} />)
    const steps = [...container.firstChild.children]
    expect(steps.map((s) => s.querySelector('.font-bold.mb-0\\.5').textContent)).toEqual(['Ben', 'Ana', 'Cy'])
    expect(within(steps[1]).getByText('1st').parentElement).toHaveClass('h-28')
    expect(within(steps[0]).getByText('2nd').parentElement).toHaveClass('h-20')
    expect(within(steps[2]).getByText('3rd').parentElement).toHaveClass('h-16')
    expect(within(steps[1]).getByText('30 laps')).toBeInTheDocument()
  })

  test('a picture, an initial, or a question mark', () => {
    const { container } = render(<ResultsPodium podium={[...podium.slice(0, 2), { driverId: 'x', totalLaps: 1 }]} />)
    expect(container.querySelector('img').getAttribute('src')).toBe('/api/img/ana.png')
    expect(screen.getByText('B')).toHaveStyle({ backgroundColor: '#6B7280' })
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  test('two drivers in order, none with fewer', () => {
    const { container, rerender } = render(<ResultsPodium podium={podium.slice(0, 2)} />)
    expect(screen.getAllByText(/Ana|Ben/).map((n) => n.textContent)).toEqual(['Ana', 'Ben'])
    rerender(<ResultsPodium podium={podium.slice(0, 1)} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ResultsPodium />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AwardCard', () => {
  test.each([
    [{ id: 'best-lap', lapTime: 7123, sessionName: 'Race 1' }, 'Best lap', ['7.123s', 'Race 1']],
    [{ id: 'best-qualif', lapTime: 7000, sessionName: 'Q1' }, 'Best qualifier', ['7.000s', 'Q1']],
    [{ id: 'best-race-lap', lapTime: 61000, sessionName: 'R2' }, 'Fastest race lap', ['1:01.000', 'R2']],
    [{ id: 'comeback', gain: 3, qualifPos: 5, racePos: 2 }, 'Biggest comeback', ['+3 places', 'P5 → P2']],
    [{ id: 'consistent', stdDev: 120, sessionName: 'R1' }, 'Most consistent driver', ['σ 0.120s', 'R1']],
    [{ id: 'iron-man', totalLaps: 80, finishedRaces: 1 }, 'Most enduring driver', ['80 laps', '1 race finished']],
  ])('%o', (award, title, values) => {
    render(<AwardCard award={{ ...award, driver: ana }} />)
    expect(screen.getByTestId('championship-award-title')).toHaveTextContent(title)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    for (const value of values) expect(screen.getByText(value)).toBeInTheDocument()
  })

  test('an unknown award shows its own title, without a value', () => {
    const { container } = render(<AwardCard award={{ id: 'from-addon', title: 'Cleanest', driver: ben }} />)
    expect(screen.getByTestId('championship-award-title')).toHaveTextContent('Cleanest')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.mt-1')).toBeEmptyDOMElement()
  })
})

describe('ResultsStandingsTable', () => {
  const standings = [
    {
      driverId: 'a',
      position: 1,
      driver: ana,
      car: { brand: 'Ferrari', model: '499P' },
      totalLaps: 30,
      totalTime: 300000,
    },
    { driverId: 'b', position: 2, driver: ben, totalLaps: 30, totalTime: 301234 },
    { driverId: 'c', position: 3, driver: cy, totalLaps: 28, totalTime: 299000 },
    { driverId: 'd', position: 4, driver: { name: 'Dee' }, totalLaps: 29, totalTime: 0 },
  ]

  test('laps, total time and the gap to the leader', () => {
    render(<ResultsStandingsTable standings={standings} />)
    const [, first, second, third, fourth] = screen.getAllByRole('row')
    expect(first).toHaveTextContent('Ana')
    expect(first).toHaveTextContent('Ferrari 499P')
    expect(first).toHaveTextContent('5:00.000')
    expect(within(first).getByText('Leader')).toBeInTheDocument()
    expect(second).toHaveTextContent('+1.234')
    expect(third).toHaveTextContent('+2 l')
    expect(fourth).toHaveTextContent('--')
    expect(within(fourth).getByText('4')).toHaveClass('text-muted-foreground')
  })

  test('the podium rows stand out', () => {
    render(<ResultsStandingsTable standings={standings} />)
    const [, first, second, third, fourth] = screen.getAllByRole('row')
    expect(first).toHaveClass('from-yellow-500/20')
    expect(second).toHaveClass('from-gray-400/10')
    expect(third).toHaveClass('from-orange-500/10')
    expect(fourth.className).toBe('')
  })

  test('nothing without standings', () => {
    const { container } = render(<ResultsStandingsTable standings={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ChampionshipResults', () => {
  const results = {
    podium: [
      { driverId: 'a', driver: ana, totalLaps: 3 },
      { driverId: 'b', driver: ben, totalLaps: 2 },
    ],
    awards: [{ id: 'iron-man', driver: ana, totalLaps: 3, finishedRaces: 2 }],
    standings: [{ driverId: 'a', position: 1, driver: ana, totalLaps: 3, totalTime: 1000 }],
  }

  test('loading, then the podium, best moments and standings', async () => {
    routeFetch({ '/api/championships/c1/results': { success: true, data: results } })
    render(<ChampionshipResults championshipId="c1" />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByTestId('championship-results-podium')).toBeInTheDocument()
    expect(screen.getByTestId('championship-results-awards')).toHaveTextContent('Best moments')
    expect(screen.getByTestId('championship-results-standings')).toHaveTextContent('Final standings')
  })

  test('only the parts there are', async () => {
    routeFetch({ '/api/championships/c1/results': { success: true, data: { awards: results.awards } } })
    render(<ChampionshipResults championshipId="c1" />)
    await screen.findByTestId('championship-results-awards')
    expect(screen.queryByTestId('championship-results-podium')).not.toBeInTheDocument()
    expect(screen.queryByTestId('championship-results-standings')).not.toBeInTheDocument()
  })

  test.each([
    ['no results yet', { success: true, data: { standings: [], awards: [] } }],
    ['unreadable results', { success: false }],
    ['an unreachable server', new Error('offline')],
  ])('a message for %s', async (_, reply) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ '/api/championships/c1/results': reply })
    render(<ChampionshipResults championshipId="c1" />)
    expect(await screen.findByText('No results available. Finish at least one race.')).toBeInTheDocument()
  })

  test('read again when a session finishes, not once gone', async () => {
    let reply = { success: true, data: { standings: [], awards: [] } }
    const mock = routeFetch({ '/api/championships/c1/results': () => reply })
    const { unmount } = render(<ChampionshipResults championshipId="c1" />)
    await screen.findByText(/No results/)
    reply = { success: true, data: results }
    act(() => window.dispatchEvent(new Event('session:finished')))
    await waitFor(() => expect(screen.getByTestId('championship-results-standings')).toBeInTheDocument())
    unmount()
    mock.mockClear()
    window.dispatchEvent(new Event('session:finished'))
    expect(mock).not.toHaveBeenCalled()
  })
})
