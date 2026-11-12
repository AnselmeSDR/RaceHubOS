import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatLevel, levelPercent } from '@racehubos/shared'
import i18n from '@/i18n'
import { field, jsonReply, renderCell, sortValue } from '@/test/helpers'
import CarCard from './CarCard'
import CarFormModal from './CarFormModal'
import CarLevelField from './CarLevelField'
import { carColumns } from './carColumns'

const GT3 = { id: 'gt3', name: 'GT3', color: '#E11D48', scope: 'car', order: 1 }
const GTE = { id: 'gte', name: 'GTE', color: '#7C3AED', scope: 'car', order: 2 }
const car = {
  id: 'c1',
  brand: 'porsche',
  model: '911',
  year: 1973,
  color: '#FF0000',
  img: null,
  maxSpeed: 80,
  brakeForce: 50,
  fuelCapacity: 100,
  bestLap: 4321,
  _count: { sessions: 2 },
  divisions: [GT3],
}
const t = i18n.getFixedT('en', 'cars')
let fetchMock

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async (url) =>
    jsonReply(url.includes('/api/divisions') ? { success: true, data: [GT3, GTE] } : { success: true })
  )
  vi.stubGlobal('fetch', fetchMock)
})
/** The form's save: the only call with a method. */
const saved = () => fetchMock.mock.calls.find(([, options]) => options?.method)
const savedBody = () => JSON.parse(saved()[1].body)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CarCard', () => {
  test('brand, model, year, categories, gauges and races, in the car colour', async () => {
    const onClick = vi.fn()
    render(<CarCard car={car} onClick={onClick} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(card).toHaveAttribute('data-entity-id', 'c1')
    expect(within(card).getByRole('heading', { name: 'porsche' })).toBeInTheDocument()
    expect(within(card).getByText('911')).toHaveStyle({ color: '#FF0000' })
    expect(card).toHaveTextContent('1973')
    // A category is outlined in its colour on a transparent background
    const category = within(card).getByTitle('GT3')
    expect(category).toHaveStyle({ borderColor: '#E11D48' })
    expect(category.style.backgroundColor).toBe('')
    for (const value of [80, 50, 100]) expect(card).toHaveTextContent(formatLevel(value))
    expect(card).toHaveTextContent('Races2')
    expect(within(card).getByText('p')).toBeInTheDocument()
    await userEvent.click(card)
    expect(onClick).toHaveBeenCalled()
  })

  test('a picture, no year, no races yet, default colour', () => {
    render(
      <CarCard
        car={{ ...car, img: 'https://img.test/911.png', year: null, color: null, _count: undefined }}
        onClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const card = screen.getByTestId('entity-card')
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://img.test/911.png')
    expect(card).not.toHaveTextContent('1973')
    expect(card).toHaveTextContent('Races0')
    expect(within(card).getByText('911')).toHaveStyle({ color: '#22C55E' })
  })
})

describe('carColumns', () => {
  const onEdit = vi.fn()
  const columns = carColumns(t, { onEdit })

  test('headers, then the edit pencil', () => {
    expect(columns.map((c) => c.meta?.label ?? c.header)).toEqual([
      'Brand',
      'Model',
      'Category',
      'Year',
      'Speed',
      'Braking',
      'Fuel',
      'Record',
      'Sessions',
      '',
    ])
    expect(columns.find((c) => c.id === 'divisions').meta.filter).toBe('divisionId')
  })

  test('cells', () => {
    expect(renderCell(columns, 'brand', car).container).toHaveTextContent('porsche')
    const model = renderCell(columns, 'model', car).container
    expect(model).toHaveTextContent('p911')
    expect(model.firstChild.firstChild).toHaveStyle({ backgroundColor: '#FF0000' })
    expect(renderCell(columns, 'year', car).container).toHaveTextContent('1973')
    expect(renderCell(columns, 'divisions', car).container).toHaveTextContent('GT3')
    const speed = renderCell(columns, 'maxSpeed', car).container
    expect(speed).toHaveTextContent(formatLevel(80))
    expect(speed.querySelector('.bg-green-500')).toHaveStyle({ width: `${levelPercent(80)}%` })
    expect(renderCell(columns, 'brakeForce', car).container).toHaveTextContent(formatLevel(50))
    expect(renderCell(columns, 'fuelCapacity', car).container).toHaveTextContent(formatLevel(100))
    expect(renderCell(columns, 'bestLap', car).container).toHaveTextContent('4.321s')
    expect(renderCell(columns, 'sessions', car).container).toHaveTextContent('2')
  })

  test('cells of a bare car', () => {
    const bare = {
      ...car,
      img: 'https://img.test/911.png',
      year: null,
      bestLap: null,
      _count: undefined,
      divisions: [],
    }
    expect(renderCell(columns, 'model', bare).container.querySelector('img')).toBeInTheDocument()
    expect(renderCell(columns, 'year', bare).container).toHaveTextContent('-')
    expect(renderCell(columns, 'divisions', bare).container).toHaveTextContent('-')
    expect(renderCell(columns, 'bestLap', bare).container).toHaveTextContent('-')
    expect(renderCell(columns, 'sessions', bare).container).toHaveTextContent('0')
  })

  test('sorting: no record last, sessions by count', () => {
    expect(sortValue(columns, 'bestLap', car)).toBe(4321)
    expect(sortValue(columns, 'bestLap', { ...car, bestLap: null })).toBe(Infinity)
    expect(sortValue(columns, 'sessions', car)).toBe(2)
    expect(sortValue(columns, 'sessions', { ...car, _count: undefined })).toBe(0)
  })
})

test('CarLevelField: a 10-level gauge in the setting colour', () => {
  const onChange = vi.fn()
  render(<CarLevelField label="Max speed" value={70} onChange={onChange} color="#22C55E" />)
  const slider = field('Max speed')
  expect(slider).toHaveAttribute('step', '10')
  expect(screen.getByText('7')).toBeInTheDocument()
  expect(slider.style.background).toContain(`${((70 - 10) / 90) * 100}%`)
  // A range input can't be dragged in jsdom: change its value directly
  fireEvent.change(slider, { target: { value: '30' } })
  expect(onChange).toHaveBeenCalledWith(30)
})

describe('CarFormModal', () => {
  test('a new car starts from defaults and is created', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onClose = vi.fn()
    render(<CarFormModal car={null} onClose={onClose} />)
    expect(screen.getByText('New car')).toBeInTheDocument()
    expect(field('Year')).toHaveValue(new Date().getFullYear())

    await user.type(field('Brand'), 'Ferrari')
    await user.type(field('Model'), 'F40')
    await user.clear(field('Year'))
    await user.type(field('Year'), '1987')
    await user.type(field('Motor'), 'S-Can')
    await user.type(field('Weight (g)'), '85')
    await user.type(field('Notes'), 'Fast')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const [url, options] = saved()
    expect(url).toMatch(/\/api\/cars$/)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toMatchObject({
      brand: 'Ferrari',
      model: 'F40',
      year: 1987,
      color: '#22C55E',
      maxSpeed: 100,
      brakeForce: 50,
      fuelCapacity: 100,
      motor: 'S-Can',
      weightGrams: '85',
      notes: 'Fast',
      divisionIds: [],
    })
    expect(await screen.findByText('Car saved')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(onClose).toHaveBeenCalled()
  })

  test('the year can be emptied, and is saved empty', async () => {
    render(<CarFormModal car={car} onClose={vi.fn()} />)
    expect(field('Year')).toHaveValue(1973)
    await userEvent.clear(field('Year'))
    expect(field('Year')).toHaveValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(savedBody().year).toBeNull()
  })

  test('a car without a year is not given this one', async () => {
    render(<CarFormModal car={{ ...car, year: null }} onClose={vi.fn()} />)
    expect(field('Year')).toHaveValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(savedBody().year).toBeNull()
  })

  test('editing a car keeps its values and saves its settings', async () => {
    render(<CarFormModal car={{ ...car, motor: 'Mabuchi' }} onClose={vi.fn()} />)
    expect(screen.getByText('Edit car')).toBeInTheDocument()
    expect(field('Brand')).toHaveValue('porsche')
    expect(field('Motor')).toHaveValue('Mabuchi')
    fireEvent.change(field('Max speed'), { target: { value: '60' } })
    fireEvent.change(field('Brake force'), { target: { value: '90' } })
    fireEvent.change(field('Fuel capacity'), { target: { value: '40' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const [url, options] = saved()
    expect(url).toMatch(/\/api\/cars\/c1$/)
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toMatchObject({ maxSpeed: 60, brakeForce: 90, fuelCapacity: 40, motor: 'Mabuchi' })
  })

  test('picking a colour', async () => {
    render(<CarFormModal car={car} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('#000000'), { target: { value: '#3B82F6' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(savedBody().color).toBe('#3B82F6')
  })
  test('a car keeps its categories; one is added, another removed', async () => {
    const user = userEvent.setup()
    render(<CarFormModal car={car} onClose={vi.fn()} />)
    const picker = screen.getByTestId('car-divisions')
    await user.click(within(picker).getByRole('button', { name: 'New category' }))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /GTE/ }))
    await user.keyboard('{Escape}')
    await user.click(within(picker).getByRole('button', { name: 'Remove GT3' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(savedBody().divisionIds).toEqual(['gte'])
  })
})
