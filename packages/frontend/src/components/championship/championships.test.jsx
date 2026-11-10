import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChampionshipStatus, SessionType } from '@racehubos/shared'
import ColumnFilterHeader from '@/components/crud/ColumnFilterHeader'
import i18n from '@/i18n'
import { field, routeFetch } from '@/test/helpers'
import { championshipColumns } from './championshipColumns'
import ChampionshipFormModal from './ChampionshipFormModal'
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

describe('ChampionshipFormModal', () => {
  function form(props = {}) {
    const handlers = { onClose: vi.fn(), onFormChange: vi.fn(), onSwitchAuto: vi.fn() }
    render(<ChampionshipFormModal tracks={tracks} {...handlers} {...props} />)
    return handlers
  }
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create' }))

  test('what is typed is shared with the wizard', async () => {
    const { onFormChange } = form()
    await userEvent.type(field('Championship name'), 'Cup')
    expect(onFormChange).toHaveBeenLastCalledWith({ name: 'Cup', trackId: '' })
    await userEvent.selectOptions(field('Track'), 't1')
    expect(onFormChange).toHaveBeenLastCalledWith({ name: 'Cup', trackId: 't1' })
  })

  test('starts from what was typed in the wizard', () => {
    form({ initialData: { name: 'Spring', trackId: 't2' } })
    expect(field('Championship name')).toHaveValue('Spring')
    expect(field('Track')).toHaveValue('t2')
  })

  test('the switch leads to the automatic wizard', async () => {
    const { onSwitchAuto } = form()
    await userEvent.click(screen.getByText('Automatic mode').nextSibling)
    expect(onSwitchAuto).toHaveBeenCalledOnce()
  })

  test('nothing is sent without a name and a track', async () => {
    const mock = routeFetch({})
    form({ initialData: { name: 'Cup', trackId: '' } })
    submit()
    expect(mock).not.toHaveBeenCalled()
  })

  test('creates this season’s championship, then closes', async () => {
    vi.useFakeTimers()
    const mock = routeFetch({ 'POST /api/championships': { success: true } })
    const { onClose } = form({ initialData: { name: 'Cup', trackId: 't1' } })
    await act(async () => submit())
    const body = JSON.parse(mock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      name: 'Cup',
      trackId: 't1',
      season: String(new Date().getFullYear()),
    })
    expect(body.sessionNames).toBeDefined()
    expect(body).not.toHaveProperty('pointsSystem')
    expect(screen.getByText('Championship created successfully')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1500))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test.each([
    ['a refusal', 400, 'Error during creation'],
    ['an unreachable server', new Error('offline'), 'Server connection error'],
  ])('%s is shown', async (_, reply, message) => {
    routeFetch({ 'POST /api/championships': reply })
    form({ initialData: { name: 'Cup', trackId: 't1' } })
    submit()
    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})
