import { cleanup, render, screen } from '@testing-library/react'
import { ChampionshipStatus, SessionType } from '@racehubos/shared'
import ColumnFilterHeader from '@/components/crud/ColumnFilterHeader'
import i18n from '@/i18n'
import { championshipColumns } from './championshipColumns'
import ChampionshipStatusBadge from './ChampionshipStatusBadge'

const t = i18n.getFixedT('en', 'championships')
const tracks = [
  { id: 't1', name: 'Monza' },
  { id: 't2', name: 'Spa' },
]

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test.each([
  [ChampionshipStatus.ACTIVE, 'In progress', 'text-green-700'],
  [ChampionshipStatus.FINISHED, 'Finished', 'text-gray-700'],
  [undefined, 'Planned', 'text-yellow-700'],
])('the %s status badge', (status, text, colour) => {
  render(<ChampionshipStatusBadge status={status} />)
  expect(screen.getByText(text)).toHaveClass(colour)
})

describe('championshipColumns', () => {
  const columns = championshipColumns(t, { tracks })
  const column = (id) => columns.find((c) => (c.id ?? c.accessorKey) === id)
  const championship = {
    name: 'Winter Cup',
    trackId: 't2',
    status: ChampionshipStatus.ACTIVE,
    sessions: [{ type: SessionType.QUALIF }, { type: SessionType.RACE }, { type: SessionType.RACE }],
  }
  const cell = (id, original = championship) => render(<>{column(id).cell({ row: { original } })}</>)

  test('the columns, the track and status ones filterable', () => {
    expect(columns.map((c) => c.id ?? c.accessorKey)).toEqual(['name', 'track', 'qualifs', 'races', 'status'])
    expect(columns.filter((c) => c.header === ColumnFilterHeader).map((c) => c.meta.filter)).toEqual([
      'trackId',
      'status',
    ])
  })

  test('the track by name, counts of qualifying and races, status planned by default', () => {
    expect(column('track').accessorFn(championship)).toBe('Spa')
    expect(column('track').accessorFn({ trackId: 'gone' })).toBe('')
    expect(column('qualifs').accessorFn(championship)).toBe(1)
    expect(column('races').accessorFn(championship)).toBe(2)
    expect(column('races').accessorFn({})).toBe(0)
    expect(column('status').accessorFn({})).toBe(ChampionshipStatus.PLANNED)
  })

  test('the cells', () => {
    cell('name')
    expect(screen.getByText('Winter Cup')).toBeInTheDocument()
    cleanup()
    cell('track')
    expect(screen.getByText('Spa')).toBeInTheDocument()
    cleanup()
    cell('track', {})
    expect(screen.getByText('Not defined')).toBeInTheDocument()
    cleanup()
    cell('qualifs')
    expect(screen.getByText('1').querySelector('svg')).toHaveClass('text-blue-500')
    cleanup()
    cell('races')
    expect(screen.getByText('2').querySelector('svg')).toHaveClass('text-green-500')
    cleanup()
    cell('status')
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })
})
