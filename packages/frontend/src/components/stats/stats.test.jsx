import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { EMPTY_LAP_FILTERS, hasLapFilters, lapFilterParams } from './lapFilters'
import LinkCell from './LinkCell'
import StatsFilterHeader from './StatsFilterHeader'
import { statsColumns } from './statsColumns'
import { StatsFilterContext } from './statsFilterContext'

const t = i18n.getFixedT('en', 'stats')
const lap = {
  lapTime: 7123,
  driver: { id: 'd1', name: 'Ana', color: '#FF0000' },
  car: { id: 'c1', brand: 'Ferrari', model: '499P', img: '/api/img/car.png' },
  track: { id: 't1', name: 'Monza', color: '#00FF00' },
  championship: { id: 'ch1', name: 'Winter Cup' },
  sessionType: SessionType.QUALIF,
  sessionDate: '2026-03-01T10:00:00Z',
}

/** Renders the cell of column `id` for `original`, at row `index`. */
function cell(id, original = lap, index = 5, onOpen = vi.fn()) {
  const column = statsColumns(t, { lang: 'en', onOpen }).find((c) => c.id === id)
  render(<>{column.cell({ row: { original, index } })}</>)
  return onOpen
}

beforeAll(() => i18n.changeLanguage('en'))
afterEach(cleanup)

describe('lap filters', () => {
  test('only the selected filters are sent, the best-lap option always', () => {
    expect(lapFilterParams(EMPTY_LAP_FILTERS)).toEqual({ unique: 'true' })
    expect(
      lapFilterParams({ ...EMPTY_LAP_FILTERS, driverId: ['d1', 'd2'], sessionType: [SessionType.RACE], unique: false })
    ).toEqual({ driverId: 'd1,d2', sessionType: SessionType.RACE, unique: 'false' })
  })

  test('the best-lap option alone does not count as a filter', () => {
    expect(hasLapFilters({ ...EMPTY_LAP_FILTERS, unique: false })).toBe(false)
    expect(hasLapFilters({ ...EMPTY_LAP_FILTERS, championshipId: ['none'] })).toBe(true)
  })
})

test('a link cell opens its page without selecting the row', async () => {
  const onOpen = vi.fn()
  const onRowClick = vi.fn()
  render(
    <div onClick={onRowClick}>
      <LinkCell to="/drivers/d1" onOpen={onOpen}>
        Ana
      </LinkCell>
    </div>
  )
  await userEvent.click(screen.getByText('Ana'))
  expect(onOpen).toHaveBeenCalledWith('/drivers/d1')
  expect(onRowClick).not.toHaveBeenCalled()
})

describe('statsColumns', () => {
  test('the columns, filterable ones by their filter key', () => {
    const columns = statsColumns(t, { lang: 'en', onOpen: vi.fn() })
    expect(columns.map((c) => c.id)).toEqual([
      'position',
      'lapTime',
      'driver',
      'car',
      'track',
      'championship',
      'sessionType',
      'date',
    ])
    expect(columns.filter((c) => c.header === StatsFilterHeader).map((c) => c.meta)).toEqual([
      { label: 'Driver', filter: 'driverId' },
      { label: 'Car', filter: 'carId' },
      { label: 'Track', filter: 'trackId' },
      { label: 'Championship', filter: 'championshipId' },
      { label: 'Session', filter: 'sessionType' },
    ])
    expect(columns.find((c) => c.id === 'car').accessorFn(lap)).toBe('Ferrari 499P')
    expect(columns.find((c) => c.id === 'driver').accessorFn({})).toBe('')
    expect(columns.find((c) => c.id === 'date').accessorFn(lap)).toBe(lap.sessionDate)
    expect(columns.find((c) => c.id === 'track').accessorFn(lap)).toBe('Monza')
    expect(columns.find((c) => c.id === 'championship').accessorFn({})).toBe('')
    expect(columns.find((c) => c.id === 'sessionType').accessorFn(lap)).toBe(SessionType.QUALIF)
  })

  test('the podium shows a trophy, then medals, then plain ranks', () => {
    cell('position', lap, 0)
    expect(document.querySelector('.bg-yellow-500 svg')).not.toBeNull()
    cleanup()
    cell('position', lap, 2)
    expect(screen.getByText('3')).toHaveClass('bg-orange-500')
    cleanup()
    cell('position', lap, 3)
    expect(screen.getByText('4')).toHaveClass('text-muted-foreground')
  })

  test('the lap time, golden on the podium', () => {
    cell('lapTime', lap, 1)
    expect(screen.getByText('7.123s')).toHaveClass('text-yellow-600')
    cleanup()
    cell('lapTime', { lapTime: 0 }, 4)
    expect(screen.getByText('-')).not.toHaveClass('text-yellow-600')
  })

  test.each([
    ['driver', 'Ana', '/drivers/d1'],
    ['car', 'Ferrari 499P', '/cars/c1'],
    ['track', 'Monza', '/tracks/t1'],
    ['championship', 'Winter Cup', '/championships/ch1'],
  ])('the %s opens its page', async (id, text, path) => {
    const onOpen = cell(id)
    await userEvent.click(screen.getByText(text))
    expect(onOpen).toHaveBeenCalledWith(path)
  })

  test('pictures, or initials on the colour', () => {
    cell('car')
    expect(document.querySelector('img').getAttribute('src')).toBe('/api/img/car.png')
    cleanup()
    cell('driver')
    expect(screen.getByText('A')).toHaveStyle({ backgroundColor: '#FF0000' })
    cleanup()
    cell('driver', { driver: { name: 'Bo' } })
    expect(screen.getByText('B')).toHaveStyle({ backgroundColor: '#666' })
  })

  test('a dash outside championships or without a date', () => {
    cell('championship', { ...lap, championship: null })
    expect(screen.getByText('—')).toBeInTheDocument()
    cleanup()
    cell('date', { ...lap, sessionDate: null })
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  test('the session type badge, unknown types as they are', () => {
    cell('sessionType')
    expect(screen.getByText('Qualifying')).toBeInTheDocument()
    cleanup()
    cell('sessionType', { sessionType: 'mystery' })
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })

  test('the date in the language of the interface', () => {
    cell('date')
    expect(screen.getByText(new Date(lap.sessionDate).toLocaleDateString('en'))).toBeInTheDocument()
  })
})

describe('StatsFilterHeader', () => {
  const column = { columnDef: { meta: { filter: 'driverId', label: 'Driver' } }, getCanSort: () => false }

  function header(context) {
    render(
      <StatsFilterContext.Provider value={context}>
        <StatsFilterHeader column={column} />
      </StatsFilterContext.Provider>
    )
  }

  test('the filter of its column, from the context', async () => {
    const setFilter = vi.fn()
    header({
      filters: { driverId: ['d1'] },
      setFilter,
      options: {
        driverId: [
          { value: 'd1', label: 'Ana' },
          { value: 'd2', label: 'Ben' },
        ],
      },
    })
    expect(screen.getByText('Driver')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('menuitemcheckbox', { name: 'Ana' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Ben' }))
    expect(setFilter).toHaveBeenCalledWith('driverId', ['d1', 'd2'])
  })

  test('nothing selected and no choices by default', async () => {
    header({ filters: {}, setFilter: vi.fn(), options: {} })
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Ana' })).not.toBeInTheDocument()
  })
})
