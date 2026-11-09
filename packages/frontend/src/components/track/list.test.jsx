import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { field, jsonReply, renderCell, sortValue } from '@/test/helpers'
import TrackCard from './TrackCard'
import TrackFormModal from './TrackFormModal'
import { trackColumns } from './trackColumns'

const track = {
  id: 't1',
  name: 'Monza',
  color: '#00AA00',
  img: null,
  length: 1200,
  corners: 3,
  bestLap: 9876,
  bestLapBy: 'Ayrton',
  _count: { sessions: 4 },
}
const t = i18n.getFixedT('en', 'tracks')
let fetchMock

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async () => jsonReply({ success: true }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('TrackCard', () => {
  test('name, length, corners, record and races, in the track colour', () => {
    render(<TrackCard track={track} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(within(card).getByRole('heading', { name: 'Monza' })).toBeInTheDocument()
    for (const text of ['Length1200m', 'Corners3', 'Record9.876s', 'by Ayrton', 'Races4']) {
      expect(card).toHaveTextContent(text)
    }
    expect(within(card).getByText('1200m')).toHaveStyle({ color: '#00AA00' })
  })

  test('a bare track: picture, nothing measured, no record, default colour', () => {
    const bare = { ...track, img: 'https://img.test/m.png', color: null, length: null, corners: null, bestLap: null }
    render(<TrackCard track={{ ...bare, _count: undefined }} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://img.test/m.png')
    for (const text of ['Length', 'Corners', 'Record']) expect(card).not.toHaveTextContent(text)
    expect(card).toHaveTextContent('Races0')
    expect(card.firstChild.nextSibling).toHaveStyle({ backgroundColor: '#9333EA' })
  })

  test('a record without its holder', () => {
    render(<TrackCard track={{ ...track, bestLapBy: null }} onClick={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByTestId('entity-card')).not.toHaveTextContent('by')
  })
})

describe('trackColumns', () => {
  const columns = trackColumns(t, { onEdit: vi.fn() })

  test('headers, then the edit pencil', () => {
    expect(columns.map((c) => c.header)).toEqual(['Name', 'Length', 'Corners', 'Record', 'Sessions', ''])
  })

  test('cells', () => {
    const name = renderCell(columns, 'name', track).container
    expect(name).toHaveTextContent('Monza')
    expect(name.firstChild.firstChild).toHaveStyle({ backgroundColor: '#00AA00' })
    expect(renderCell(columns, 'length', track).container).toHaveTextContent('1200m')
    expect(renderCell(columns, 'corners', track).container).toHaveTextContent('3')
    expect(renderCell(columns, 'bestLap', track).container).toHaveTextContent('9.876sby Ayrton')
    expect(renderCell(columns, 'sessions', track).container).toHaveTextContent('4')
  })

  test('cells of a bare track', () => {
    const bare = {
      ...track,
      img: 'https://img.test/m.png',
      length: null,
      corners: null,
      bestLap: null,
      bestLapBy: null,
    }
    const empty = { ...bare, _count: undefined }
    expect(renderCell(columns, 'name', empty).container.querySelector('img')).toBeInTheDocument()
    expect(renderCell(columns, 'length', empty).container).toHaveTextContent('-')
    expect(renderCell(columns, 'corners', empty).container).toHaveTextContent('-')
    expect(renderCell(columns, 'bestLap', empty).container.textContent).toBe('-')
    expect(renderCell(columns, 'sessions', empty).container).toHaveTextContent('0')
  })

  test('sorting', () => {
    expect(sortValue(columns, 'length', track)).toBe(1200)
    expect(sortValue(columns, 'length', { ...track, length: null })).toBe(0)
    expect(sortValue(columns, 'corners', { ...track, corners: null })).toBe(0)
    expect(sortValue(columns, 'corners', track)).toBe(3)
    expect(sortValue(columns, 'bestLap', { ...track, bestLap: null })).toBe(Infinity)
    expect(sortValue(columns, 'bestLap', track)).toBe(9876)
    expect(sortValue(columns, 'sessions', track)).toBe(4)
    expect(sortValue(columns, 'sessions', { ...track, _count: undefined })).toBe(0)
  })
})

describe('TrackFormModal', () => {
  test('a new track: numbers are sent as numbers, blanks as null', async () => {
    const user = userEvent.setup()
    render(<TrackFormModal track={null} onClose={vi.fn()} />)
    expect(screen.getByText('New track')).toBeInTheDocument()
    await user.type(field('Name'), 'Spa')
    await user.type(field('Length (m)'), '14.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/tracks$/)
    expect(JSON.parse(options.body)).toEqual({ name: 'Spa', img: null, length: 14.5, corners: null, color: '#9333EA' })
    expect(await screen.findByText('Track saved')).toBeInTheDocument()
  })

  test('editing a track', async () => {
    const user = userEvent.setup()
    render(<TrackFormModal track={{ ...track, img: '/uploads/m.png' }} onClose={vi.fn()} />)
    expect(screen.getByText('Edit track')).toBeInTheDocument()
    await user.clear(field('Corners'))
    await user.type(field('Corners'), '7')
    fireEvent.change(screen.getByPlaceholderText('#000000'), { target: { value: '#123456' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/tracks\/t1$/)
    expect(JSON.parse(options.body)).toEqual({
      name: 'Monza',
      img: '/uploads/m.png',
      length: 1200,
      corners: 7,
      color: '#123456',
    })
  })
})
