import { cleanup, render, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import BalancingChart from './BalancingChart'
import BalancingStandings from './BalancingStandings'
import { balancingSeries, carStatsOf, chartColor, chartRows, medianChange, medianOf, trendOf } from './balancingStats'

// A sized chart (jsdom measures nothing) and a tooltip showing what it would for lap 3
vi.mock('recharts', async (importOriginal) => {
  const recharts = await importOriginal()
  const { cloneElement } = await import('react')
  return {
    ...recharts,
    ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 400 }),
    Tooltip: ({ formatter, labelFormatter }) => (
      <text data-testid="tooltip">
        {[labelFormatter(3), ...formatter(8.1234, 'Ford GT-0'), formatter(9, 'gone')[1]].join(' | ')}
      </text>
    ),
  }
})

const laps = (...times) => times.map((lapTime, i) => ({ lapNumber: i + 1, lapTime }))
const named = (name) => () => name

beforeAll(() => i18n.changeLanguage('en'))
afterEach(cleanup)

describe('figures', () => {
  test('the median of odd and even counts, none of nothing', () => {
    expect(medianOf([])).toBeNull()
    expect(medianOf([3, 1, 2])).toBe(2)
    expect(medianOf([4, 1, 3, 2])).toBe(2.5)
  })

  test('a car color readable on the chart', () => {
    expect(chartColor(undefined)).toBe('#3B82F6')
    expect(chartColor('#FFF')).toBe('#94A3B8')
    expect(chartColor('White')).toBe('#94A3B8')
    expect(chartColor('#e10600')).toBe('#e10600')
  })

  test('the trend from ten laps on, stable within 50 ms', () => {
    expect(trendOf(Array(9).fill(8000))).toBeNull()
    expect(trendOf(Array(10).fill(0))).toBeNull()
    expect(trendOf([...Array(5).fill(8000), ...Array(5).fill(8040)])).toEqual({ direction: 'stable', delta: 40 })
    expect(trendOf([...Array(5).fill(8000), ...Array(5).fill(8200)])).toEqual({ direction: 'slower', delta: 200 })
    expect(trendOf([...Array(5).fill(8200), ...Array(5).fill(8000)])).toEqual({ direction: 'faster', delta: -200 })
  })

  test('the cars with laps, named, without the out lap nor the laps over the limit', () => {
    const entries = [
      { controller: 0, laps: laps(9000) },
      { controller: 1, car: { brand: 'Ford', model: 'GT' }, laps: [] },
      { controller: 2, car: { brand: 'Ford', model: 'GT', color: 'white' }, laps: laps(9000, 8000, 12000, 8100) },
      { controller: 3, car: {}, laps: laps(9000, 8500) },
    ]
    expect(balancingSeries(entries, 10000, (n) => `Car ${n}`)).toEqual([
      {
        key: 'Ford GT-2',
        name: 'Ford GT',
        color: '#94A3B8',
        laps: [laps(0, 8000)[1], { lapNumber: 4, lapTime: 8100 }],
      },
      { key: 'Car 4-3', name: 'Car 4', color: '#3B82F6', laps: [{ lapNumber: 2, lapTime: 8500 }] },
    ])
    expect(balancingSeries(entries, null, named('x'))[0].laps).toHaveLength(3)
  })

  test('one chart row per lap from the second, in seconds, a car missing where it has no lap', () => {
    expect(chartRows([])).toEqual([])
    const series = [
      {
        key: 'a',
        laps: [
          { lapNumber: 2, lapTime: 8000 },
          { lapNumber: 4, lapTime: 8100 },
        ],
      },
      { key: 'b', laps: [{ lapNumber: 3, lapTime: 9000 }] },
    ]
    expect(chartRows(series)).toEqual([
      { lap: 2, a: 8 },
      { lap: 3, b: 9 },
      { lap: 4, a: 8.1 },
    ])
  })

  test("each car's figures, the best median of five first, the gap to it", () => {
    const series = [
      { key: 'empty', laps: [] },
      { key: 'few', name: 'Few', color: 'red', laps: laps(9000, 8500, 8800) },
      { key: 'slow', laps: laps(8300, 8100, 8400, 8200, 8000, 8600) },
      { key: 'fast', laps: laps(...Array(5).fill(8000), ...Array(5).fill(7600)) },
    ]
    const [fast, slow, few] = carStatsOf(series)
    expect(fast).toMatchObject({
      key: 'fast',
      best: 7600,
      avg60: 7666.666666666667,
      medianWindows: [
        { from: 1, to: 5, value: 7600 },
        { from: 6, to: 10, value: 8000 },
      ],
      bestMedianWindow: 7600,
      trend: { direction: 'faster', delta: -400 },
      totalLaps: 10,
      deltaToFastest: 0,
    })
    expect(slow).toMatchObject({ best: 8000, avg60: 8150, bestMedianWindow: 8200, trend: null, deltaToFastest: 600 })
    expect(few).toEqual({
      key: 'few',
      name: 'Few',
      color: 'red',
      best: 8500,
      avg60: null,
      medianWindows: [],
      bestMedianWindow: null,
      trend: null,
      totalLaps: 3,
      deltaToFastest: null,
    })
    expect(carStatsOf([])).toEqual([])
  })

  test("a session's median against the one before, steady within 50 ms", () => {
    expect(medianChange(8000, undefined)).toBeNull()
    expect(medianChange(7900, 8000)).toBe('improved')
    expect(medianChange(8100, 8000)).toBe('degraded')
    expect(medianChange(8050, 8000)).toBe('steady')
  })
})

describe('BalancingChart', () => {
  test('a message until a car has laps', () => {
    render(<BalancingChart />)
    expect(screen.getByText('No lap data available')).toBeInTheDocument()
  })

  test('the chart without figures while no lap counts yet', () => {
    render(<BalancingChart entries={[{ controller: 0, car: {}, laps: laps(9000) }]} />)
    expect(screen.getByText('Lap time evolution')).toBeInTheDocument()
    expect(screen.queryByTestId('balancing-car-card')).not.toBeInTheDocument()
  })

  test("the cars' laps on the chart, then their figures, the steadiest first", () => {
    const entries = [
      {
        controller: 1,
        car: { brand: 'Porsche', color: '#ffffff' },
        laps: laps(9999, 8300, 8100, 8400, 8200, 8000, 8600),
      },
      {
        controller: 0,
        car: { brand: 'Ford', model: 'GT' },
        laps: laps(9999, ...Array(5).fill(8200), ...Array(5).fill(8000)),
      },
    ]
    render(<BalancingChart entries={entries} maxLapTime={9000} />)

    expect(screen.getByTestId('tooltip')).toHaveTextContent('Lap 3 | 8.123s | Ford GT | gone')
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(2)

    const [ford, porsche] = screen.getAllByTestId('balancing-car-card')
    expect(within(ford).getByText('Ford GT')).toBeInTheDocument()
    expect(within(ford).getByText('10 laps')).toBeInTheDocument()
    expect(within(ford).getByTestId('trend-faster')).toBeInTheDocument()
    expect(within(ford).getByText('1-5')).toBeInTheDocument()
    expect(within(ford).getByText('6-10')).toBeInTheDocument()
    expect(within(ford).queryByText(/^\+/)).not.toBeInTheDocument()

    expect(within(porsche).getByText('Porsche')).toBeInTheDocument()
    expect(within(porsche).getByText('6 laps')).toBeInTheDocument()
    expect(within(porsche).getByText('+0.200')).toBeInTheDocument()
    expect(within(porsche).getByText('8.150')).toBeInTheDocument()
    expect(within(porsche).queryByTestId(/^trend-/)).not.toBeInTheDocument()
  })

  test('a slower or steady car shows its trend', () => {
    const entries = [
      { controller: 0, car: { model: 'A' }, laps: laps(0, ...Array(5).fill(8000), ...Array(5).fill(8300)) },
      { controller: 1, car: { model: 'B' }, laps: laps(0, ...Array(10).fill(8000)) },
    ]
    render(<BalancingChart entries={entries} />)
    expect(screen.getByTestId('trend-slower')).toBeInTheDocument()
    expect(screen.getByTestId('trend-stable')).toBeInTheDocument()
  })
})

describe('BalancingStandings', () => {
  test('a message while no car has a timed lap', () => {
    render(<BalancingStandings standings={[{ carId: 'c1', lapTime: 0 }]} />)
    expect(screen.getByText('No standings available')).toBeInTheDocument()
  })

  test('the fastest car first, the gap behind it, the figures it has, its sessions from the second', () => {
    const standings = [
      {
        carId: 'c2',
        car: { brand: 'Porsche', model: '911', color: '#e10600' },
        lapTime: 8250,
        median: 8400,
        laps: 30,
        history: [{ median: 8500 }, { median: 8400 }, { median: 8430 }, { median: 8600 }],
      },
      { carId: 'c1', car: { brand: 'Ford', model: 'GT', img: '/uploads/gt.png' }, lapTime: 8000, avg60: 8100 },
      { carId: 'c3', lapTime: 9000, history: [{ median: 9100 }] },
    ]
    render(<BalancingStandings standings={standings} />)
    const [ford, porsche, unknown] = screen.getAllByTestId('balancing-standing')

    expect(ford).toHaveTextContent('1')
    expect(within(ford).getByRole('img', { name: 'Ford GT' })).toHaveAttribute('src', expect.stringContaining('gt.png'))
    expect(ford).toHaveTextContent('0 laps · 0 sessions')
    expect(within(ford).getByText('60%')).toBeInTheDocument()
    expect(within(ford).queryByText('Med.')).not.toBeInTheDocument()
    expect(within(ford).queryByText(/^\+/)).not.toBeInTheDocument()

    expect(within(porsche).getByText('P')).toBeInTheDocument()
    expect(porsche).toHaveTextContent('30 laps · 4 sessions')
    expect(within(porsche).getByText('+0.250')).toBeInTheDocument()
    expect(within(porsche).getByText('Med.')).toBeInTheDocument()
    expect(within(porsche).queryByText('60%')).not.toBeInTheDocument()
    expect(within(porsche).getByTestId('median-first')).toHaveTextContent('8.500')
    expect(within(porsche).getByTestId('median-improved')).toHaveTextContent('8.400')
    expect(within(porsche).getByTestId('median-steady')).toHaveTextContent('8.430')
    expect(within(porsche).getByTestId('median-degraded')).toHaveTextContent('8.600')

    expect(within(unknown).getByText('C')).toBeInTheDocument()
    expect(unknown).toHaveTextContent('+1.000')
    expect(within(unknown).queryByTestId('median-first')).not.toBeInTheDocument()
  })
})
