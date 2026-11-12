import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { field, jsonReply, renderCell, routeFetch, sortValue } from '@/test/helpers'
import DriverCard from './DriverCard'
import DriverFormModal from './DriverFormModal'
import { driverColumns } from './driverColumns'

const driver = {
  id: 'd1',
  name: 'Ayrton',
  color: '#FFCC00',
  img: null,
  number: 12,
  divisions: [{ id: 'dv1', name: 'SILVER', color: '#C4C4C4', scope: 'driver', order: 2 }],
  wins: 3,
  podiums: 5,
  bestLap: 7654,
  _count: { sessions: 6, laps: 120 },
}
const t = i18n.getFixedT('en', 'drivers')
let fetchMock

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async () => jsonReply({ success: true }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('DriverCard', () => {
  test('name, number, divisions, results and best lap', () => {
    render(<DriverCard driver={driver} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(within(card).getByRole('heading', { name: 'AYRTON' })).toHaveStyle({ color: '#FFCC00' })
    expect(card).toHaveTextContent('12')
    // A pale division takes dark text
    expect(within(card).getByTitle('SILVER')).toHaveStyle({ backgroundColor: '#C4C4C4', color: '#1c1917' })
    for (const text of ['Races6', 'Podiums5', 'Laps120', 'Best Lap7.654s']) expect(card).toHaveTextContent(text)
    // Podiums stand out once there is one, and a winner wears a trophy
    expect(within(card).getByText('Podiums').parentElement).toHaveClass('ring-yellow-400')
    expect(card.querySelectorAll('.bg-yellow-500')).toHaveLength(1)
  })

  test('a newcomer: picture, no number, division or results', () => {
    const rookie = {
      ...driver,
      img: 'https://img.test/a.png',
      number: null,
      divisions: [],
      wins: 0,
      podiums: 0,
      bestLap: null,
    }
    render(
      <DriverCard driver={{ ...rookie, _count: undefined }} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
    const card = screen.getByTestId('entity-card')
    expect(within(card).getByRole('img', { name: 'Ayrton' })).toHaveAttribute('src', 'https://img.test/a.png')
    expect(within(card).queryByTestId('division-badge')).not.toBeInTheDocument()
    expect(card).not.toHaveTextContent('Best Lap')
    expect(within(card).getByText('Podiums').parentElement).not.toHaveClass('ring-yellow-400')
    expect(card.querySelectorAll('.bg-yellow-500')).toHaveLength(0)
    for (const text of ['Races0', 'Laps0']) expect(card).toHaveTextContent(text)
  })
})

describe('driverColumns', () => {
  const columns = driverColumns(t, { onEdit: vi.fn() })

  test('headers, then the edit pencil; the division one filters', () => {
    expect(columns.map((c) => c.meta?.label ?? c.header)).toEqual([
      'Driver',
      'No.',
      'Division',
      'Races',
      'Wins',
      'Podiums',
      'Laps',
      'Record',
      '',
    ])
    expect(columns.find((c) => c.id === 'divisions').meta.filter).toBe('divisionId')
  })

  test('cells', () => {
    const name = renderCell(columns, 'name', driver).container
    expect(name).toHaveTextContent('AAyrton')
    expect(name.firstChild.firstChild).toHaveStyle({ backgroundColor: '#FFCC00' })
    expect(renderCell(columns, 'number', driver).container).toHaveTextContent('12')
    expect(renderCell(columns, 'divisions', driver).container).toHaveTextContent('SILVER')
    expect(renderCell(columns, 'sessions', driver).container).toHaveTextContent('6')
    expect(renderCell(columns, 'wins', driver).container).toHaveTextContent('3')
    expect(renderCell(columns, 'podiums', driver).container).toHaveTextContent('5')
    expect(renderCell(columns, 'laps', driver).container).toHaveTextContent('120')
    expect(renderCell(columns, 'bestLap', driver).container).toHaveTextContent('7.654s')
  })

  test('cells of a bare driver', () => {
    const bare = { ...driver, img: 'https://img.test/a.png', color: null, number: null, divisions: [], wins: null }
    const empty = { ...bare, podiums: null, bestLap: null, _count: undefined }
    expect(renderCell(columns, 'name', empty).container.querySelector('img')).toBeInTheDocument()
    expect(renderCell(columns, 'number', empty).container).toHaveTextContent('-')
    expect(renderCell(columns, 'divisions', empty).container).toHaveTextContent('-')
    for (const id of ['sessions', 'wins', 'podiums', 'laps']) {
      expect(renderCell(columns, id, empty).container).toHaveTextContent('0')
    }
    expect(renderCell(columns, 'bestLap', empty).container).toHaveTextContent('-')
  })

  test('sorting', () => {
    expect(sortValue(columns, 'divisions', driver)).toBe('SILVER')
    expect(sortValue(columns, 'divisions', { ...driver, divisions: undefined })).toBe('')
    expect(sortValue(columns, 'sessions', { ...driver, _count: undefined })).toBe(0)
    expect(sortValue(columns, 'laps', driver)).toBe(120)
    expect(sortValue(columns, 'laps', { ...driver, _count: undefined })).toBe(0)
    expect(sortValue(columns, 'bestLap', { ...driver, bestLap: null })).toBe(Infinity)
  })
})

describe('DriverFormModal', () => {
  const divisions = [
    { id: 'dv0', name: 'GOLD', color: '#F5D13C', scope: 'driver', order: 1 },
    { id: 'dv1', name: 'SILVER', color: '#C4C4C4', scope: 'driver', order: 2 },
  ]
  const cars = [
    { id: 'car1', brand: 'Ferrari', model: '488 GT3', img: 'cars/ferrari.png' },
    { id: 'car2', brand: 'BMW', model: 'M4 GT3', img: null },
  ]
  // The cars offered, then what was saved
  beforeEach(() => {
    fetchMock = routeFetch({
      '/api/cars': { success: true, data: cars },
      '/api/divisions': { success: true, data: divisions },
      'POST /api/drivers': { success: true },
      'PUT /api/drivers': { success: true },
    })
  })
  const saved = () => fetchMock.mock.calls.find(([, init]) => init?.method)

  test('a new driver, with a number, email and divisions', async () => {
    const user = userEvent.setup()
    render(<DriverFormModal driver={null} onClose={vi.fn()} />)
    expect(screen.getByText('New driver')).toBeInTheDocument()
    await user.type(field('Name'), 'Nigel')
    await user.type(field('Number'), '5')
    await user.type(field('Email'), 'nigel@example.com')
    await user.click(screen.getByRole('button', { name: 'New division' }))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /GOLD/ }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: /SILVER/ }))
    await user.keyboard('{Escape}')
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Preferred car' }), 'car1')
    expect(screen.getByRole('img', { name: 'Ferrari 488 GT3' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const [url, options] = saved()
    expect(url).toMatch(/\/api\/drivers$/)
    expect(JSON.parse(options.body)).toEqual({
      name: 'Nigel',
      number: 5,
      email: 'nigel@example.com',
      img: '',
      color: '#3B82F6',
      divisionIds: ['dv0', 'dv1'],
      preferredCarId: 'car1',
    })
    expect(await screen.findByText('Driver saved')).toBeInTheDocument()
  })

  test('editing: clearing the number, leaving a division and dropping the preferred car', async () => {
    const user = userEvent.setup()
    render(<DriverFormModal driver={{ ...driver, preferredCarId: 'car2' }} onClose={vi.fn()} />)
    expect(screen.getByText('Edit driver')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Remove SILVER' }))
    const preferred = await screen.findByRole('combobox', { name: 'Preferred car' })
    await waitFor(() => expect(preferred).toHaveValue('car2'))
    await user.clear(field('Number'))
    await user.selectOptions(preferred, '')
    fireEvent.change(screen.getByPlaceholderText('#000000'), { target: { value: '#123456' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const [url, options] = saved()
    expect(url).toMatch(/\/api\/drivers\/d1$/)
    expect(JSON.parse(options.body)).toMatchObject({
      number: '',
      divisionIds: [],
      color: '#123456',
      preferredCarId: null,
    })
  })
})
