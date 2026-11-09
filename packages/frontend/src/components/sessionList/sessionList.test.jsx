import { cleanup, render, screen } from '@testing-library/react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import ColumnFilterHeader from '@/components/crud/ColumnFilterHeader'
import i18n from '@/i18n'
import { sessionColumns } from './sessionColumns'
import SessionStatusIcon from './SessionStatusIcon'

const t = i18n.getFixedT('en', 'sessions')
const session = {
  id: 'abcdef1234',
  name: 'Grand Prix',
  type: SessionType.RACE,
  status: SessionStatus.FINISHED,
  track: { name: 'Monza' },
  championship: { name: 'Winter Cup' },
  drivers: [{}, {}, {}],
  _count: { laps: 42 },
  startedAt: '2026-03-01T10:00:00Z',
  finishedAt: '2026-03-01T10:05:07Z',
  updatedAt: '2026-03-01T10:06:00Z',
}
const columns = sessionColumns(t, { lang: 'en' })
const column = (id) => columns.find((c) => (c.id ?? c.accessorKey) === id)
const cell = (id, original = session) => render(<>{column(id).cell({ row: { original } })}</>)

beforeAll(() => i18n.changeLanguage('en'))
afterEach(cleanup)

test.each([
  [SessionStatus.DRAFT, 'text-gray-500'],
  [SessionStatus.ACTIVE, 'text-green-500'],
  [SessionStatus.FINISHED, 'text-blue-500'],
])('the %s status has its icon', (status, colour) => {
  const { container } = render(<SessionStatusIcon status={status} />)
  expect(container.querySelector('svg')).toHaveClass(colour)
})

test('no icon for the other statuses', () => {
  const { container } = render(<SessionStatusIcon status={SessionStatus.PAUSED} />)
  expect(container).toBeEmptyDOMElement()
})

test('the columns, filterable ones by their filter key', () => {
  expect(columns.map((c) => c.id ?? c.accessorKey)).toEqual([
    'name',
    'type',
    'track',
    'status',
    'championship',
    'drivers',
    'laps',
    'duration',
    'date',
  ])
  expect(columns.filter((c) => c.header === ColumnFilterHeader).map((c) => c.meta.filter)).toEqual([
    'type',
    'trackId',
    'status',
    'championshipId',
  ])
})

test('what each column sorts by', () => {
  expect(column('type').accessorFn(session)).toBe(SessionType.RACE)
  expect(column('track').accessorFn(session)).toBe('Monza')
  expect(column('track').accessorFn({})).toBe('')
  expect(column('status').accessorFn(session)).toBe(SessionStatus.FINISHED)
  expect(column('championship').accessorFn({})).toBe('')
  expect(column('drivers').accessorFn(session)).toBe(3)
  expect(column('drivers').accessorFn({})).toBe(0)
  expect(column('laps').accessorFn(session)).toBe(42)
  expect(column('laps').accessorFn({})).toBe(0)
  expect(column('duration').accessorFn(session)).toBe(307000)
  expect(column('duration').accessorFn({})).toBe(0)
  expect(column('date').accessorFn(session)).toBe(session.updatedAt)
})

test('the name with its championship, or the short id', () => {
  cell('name')
  expect(screen.getByText('Grand Prix')).toBeInTheDocument()
  expect(screen.getByText('Winter Cup')).toBeInTheDocument()
  cleanup()
  cell('name', { id: 'abcdef1234' })
  expect(screen.getByText('Session #abcdef12')).toBeInTheDocument()
})

test('type, track and status in words', () => {
  cell('type')
  expect(screen.getByText('Race')).toBeInTheDocument()
  cleanup()
  cell('type', { type: 'mystery' })
  expect(screen.getByText('mystery')).toBeInTheDocument()
  cleanup()
  cell('track', {})
  expect(screen.getByText('Not defined')).toBeInTheDocument()
  cleanup()
  cell('status')
  expect(screen.getByText('Finished')).toBeInTheDocument()
  cleanup()
  cell('status', { status: 'odd' })
  expect(screen.getByText('odd')).toBeInTheDocument()
})

test('counts, duration and date, dashes when missing', () => {
  cell('drivers')
  expect(screen.getByText('3')).toBeInTheDocument()
  cleanup()
  cell('laps', {})
  expect(screen.getByText('0')).toBeInTheDocument()
  cleanup()
  cell('duration')
  expect(screen.getByText('5:07')).toBeInTheDocument()
  cleanup()
  cell('duration', {})
  expect(screen.getByText('-')).toBeInTheDocument()
  cleanup()
  cell('championship', {})
  expect(screen.getByText('-')).toBeInTheDocument()
  cleanup()
  cell('date', {})
  expect(screen.getByText('-')).toBeInTheDocument()
  cleanup()
  cell('date')
  expect(screen.getByText(/2026/)).toBeInTheDocument()
})
