import { cleanup, render, screen, within } from '@testing-library/react'
import { SessionStatus } from '@racehubos/shared'
import i18n from '@/i18n'
import SessionLeaderboard from '../SessionLeaderboard'
import RowIdentity from './RowIdentity'
import RowPosition from './RowPosition'
import { positionColor, rowColor, sortEntries, withPositions } from './leaderboardOrder'

const app = vi.hoisted(() => ({ isDark: false }))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))

const entry = (id, stats, extra = {}) => ({ id, stats, ...extra })
const a = entry('a', { laps: 10, bestLap: 9000, totalTime: 95000 })
const b = entry('b', { laps: 10, bestLap: 8800, totalTime: 94000 })
const c = entry('c', { laps: 8, bestLap: 8700, totalTime: 80000 })
const d = entry('d', {})

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  app.isDark = false
})

describe('order', () => {
  test('practice by laps then best lap; qualifying by best lap; race by laps then total time', () => {
    expect(sortEntries([a, d, c, b], 'laps').map((e) => e.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(sortEntries([a, d, c, b], undefined).map((e) => e.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(sortEntries([a, d, c, b], 'bestLap').map((e) => e.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(sortEntries([a, d, c, b], 'race').map((e) => e.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(sortEntries([{ id: 'x' }, a], 'race').map((e) => e.id)).toEqual(['a', 'x'])
  })

  test('positions; in a race, the gap to the leader in laps or time', () => {
    const race = withPositions([b, a, c, d], 'race')
    expect(race.map((e) => [e.position, e.displayGap])).toEqual([
      [1, null],
      [2, { type: 'time', value: 1000 }],
      [3, { type: 'laps', value: 2 }],
      [4, { type: 'laps', value: 10 }],
    ])
    expect(withPositions([{ id: 'x' }, { id: 'y' }], 'race')[1].displayGap).toEqual({ type: 'time', value: 0 })
    expect(withPositions([b, a], 'laps').map((e) => e.displayGap)).toEqual([null, null])
  })

  test('row colors stay readable; podium colors', () => {
    expect(rowColor(null)).toBe('#3B82F6')
    expect(rowColor('#FFF')).toBe('#3B82F6')
    expect(rowColor('blue')).toBe('#ffffff')
    expect(rowColor('#e10600')).toBe('#e10600')
    expect(rowColor(42)).toBe(42)
    expect([1, 2, 3, 4].map(positionColor)).toEqual([
      'text-yellow-500',
      'text-gray-400',
      'text-orange-500',
      'text-muted-foreground',
    ])
  })
})

describe('RowPosition', () => {
  test('places won, lost, or none', () => {
    const { rerender } = render(<RowPosition position={2} delta={1} />)
    expect(screen.getByTestId('leaderboard-position')).toHaveTextContent('21')
    expect(screen.getByTestId('leaderboard-position').querySelector('.text-green-500')).not.toBeNull()
    rerender(<RowPosition position={2} delta={-3} expanded />)
    expect(screen.getByTestId('leaderboard-position').querySelector('.text-red-500')).toHaveTextContent('3')
    rerender(<RowPosition position={2} delta={0} />)
    expect(screen.getByTestId('leaderboard-position')).toHaveTextContent(/^2$/)
    rerender(<RowPosition position={2} />)
    expect(screen.getByTestId('leaderboard-position')).toHaveTextContent(/^2$/)
  })
})

describe('RowIdentity', () => {
  test('photo, number, car picture, last name and car, each with its divisions', () => {
    render(
      <RowIdentity
        driver={{
          name: 'Ana Lopes',
          number: 123,
          img: '/uploads/ana.png',
          divisions: [{ id: 'gold', name: 'GOLD', scope: 'driver' }],
        }}
        car={{
          brand: 'Ferrari',
          model: '499P',
          img: '/uploads/car.png',
          color: '#e10600',
          divisions: [{ id: 'gt3', name: 'GT3', scope: 'car' }],
        }}
        color="#000"
        expanded
      />
    )
    expect(screen.getByAltText('Ana Lopes')).toBeInTheDocument()
    // The car cut out on its background: whole, with no rounded frame around it
    const carPicture = screen.getByAltText('Ferrari 499P')
    expect(carPicture).toHaveClass('object-contain')
    expect(carPicture.parentElement.className).not.toMatch(/rounded|overflow-hidden|shadow/)
    expect(screen.getByText('123')).toHaveClass('text-5xl')
    expect(screen.getByText('Lopes')).toBeInTheDocument()
    expect(screen.getByText('Ferrari 499P')).toBeInTheDocument()
    expect(screen.getAllByTestId('division-badge').map((b) => b.textContent)).toEqual(['GOLD', 'GT3'])
  })

  test('an unknown driver gets an initial; a black number is outlined in the dark', () => {
    app.isDark = true
    render(<RowIdentity driver={{ number: 7 }} car={{ name: 'Kart' }} color="#000000" />)
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('7')).toHaveClass('text-5xl')
    expect(screen.getByText('7').style.webkitTextStroke).toBe('2px white')
    cleanup()
    render(<RowIdentity driver={{ name: 'Ben', number: 777 }} car={{}} color="#000" />)
    expect(screen.getByText('777')).toHaveClass('text-4xl')
    cleanup()
    render(<RowIdentity driver={{ name: 'Ben', number: 7 }} car={{}} color="#000" expanded />)
    expect(screen.getByText('7')).toHaveClass('text-6xl')
  })
})

describe('SessionLeaderboard', () => {
  const rows = () => screen.getAllByTestId('leaderboard-row')
  const stat = (row, label) => within(row).getByText(label).nextSibling

  test('empty', () => {
    render(<SessionLeaderboard entries={[]} />)
    expect(screen.getByText('No entries in the leaderboard')).toBeInTheDocument()
    cleanup()
    render(<SessionLeaderboard entries={null} />)
    expect(screen.getByText('No entries in the leaderboard')).toBeInTheDocument()
  })

  test('practice: by laps, the leader shows its best lap, the others their gap', () => {
    render(
      <SessionLeaderboard
        entries={[
          { ...a, driver: { name: 'Ana', color: '#fff' }, stats: { ...a.stats, gap: 200, lastLap: 9100 } },
          { ...b, driver: { name: 'Ben' }, hasFastestLap: true },
          { controller: 3 },
        ]}
      />
    )
    const [first, second, third] = rows()
    expect(first).toHaveTextContent('Ben')
    expect(stat(first, 'Laps')).toHaveTextContent('10')
    expect(stat(first, 'Gap')).toHaveTextContent('0:08.800')
    expect(stat(second, 'Last')).toHaveTextContent('9.100')
    expect(stat(third, 'Laps')).toHaveTextContent('0')
    expect(first.style.boxShadow).toContain('#3B82F6')
  })

  test('race: the leader is "Leader" while running, its total once finished; the others behind it', () => {
    const entries = [
      { ...a, driver: { name: 'Ana' } },
      { ...c, driver: { name: 'Cid' } },
      { ...b, driver: { name: 'Ben' } },
    ]
    const { rerender } = render(<SessionLeaderboard entries={entries} sortBy="race" expanded />)
    let [first, second, third] = rows()
    expect(stat(first, 'Gap')).toHaveTextContent('Leader')
    expect(stat(third, 'Gap')).toHaveTextContent('+2 laps')
    expect(second).toHaveTextContent('Ana')
    rerender(<SessionLeaderboard entries={entries} sortBy="race" sessionStatus={SessionStatus.FINISHED} />)
    ;[first] = rows()
    expect(stat(first, 'Total')).toHaveTextContent('1:34.000')
  })

  test('no shadow in the dark', () => {
    app.isDark = true
    render(<SessionLeaderboard entries={[a]} sortBy="bestLap" />)
    expect(rows()[0].style.boxShadow).toBe('none')
  })
})
