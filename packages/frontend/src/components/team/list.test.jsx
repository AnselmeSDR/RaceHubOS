import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { field, jsonReply, renderCell, sortValue } from '@/test/helpers'
import TeamCard from './TeamCard'
import TeamFormModal from './TeamFormModal'
import { teamColumns } from './teamColumns'

const drivers = [
  { id: 'd1', name: 'Ayrton', number: 12 },
  { id: 'd2', name: 'Alain', number: null },
  { id: 'd3', name: 'Gerhard', number: 28 },
  { id: 'd4', name: 'Nelson', number: 6 },
]
const team = { id: 'tm1', name: 'McLaren', color: '#FF8000', img: null, drivers, _count: { drivers: 4 } }
const t = i18n.getFixedT('en', 'teams')
let fetchMock

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async () => jsonReply({ success: true }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('TeamCard', () => {
  test('name, colour and the first three drivers', () => {
    render(<TeamCard team={team} onClick={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(within(card).getByRole('heading', { name: 'McLaren' })).toBeInTheDocument()
    expect(card).toHaveTextContent('#FF8000')
    expect(card).toHaveTextContent('Drivers4')
    expect(card).toHaveTextContent('Ayrton#12')
    expect(card).toHaveTextContent('Gerhard#28')
    expect(card).not.toHaveTextContent('Nelson')
    expect(card).toHaveTextContent('+1 more')
    // The card itself opens the form: no edit button
    expect(within(card).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('a team without drivers, colour or count', () => {
    const empty = { ...team, img: 'https://img.test/l.png', color: null, drivers: [], _count: undefined }
    render(<TeamCard team={empty} onClick={vi.fn()} onDelete={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://img.test/l.png')
    expect(card).toHaveTextContent('#F97316')
    expect(card).toHaveTextContent('Drivers0')
    expect(card).toHaveTextContent('No drivers')
  })

  test('three drivers or fewer: no "more"', () => {
    render(<TeamCard team={{ ...team, drivers: drivers.slice(0, 3) }} onClick={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByTestId('entity-card')).not.toHaveTextContent('more')
  })
})

describe('teamColumns', () => {
  const columns = teamColumns(t)

  test('headers: no edit column, the row opens the form', () => {
    expect(columns.map((c) => c.header)).toEqual(['Team', 'Color', 'Drivers'])
  })

  test('cells', () => {
    const name = renderCell(columns, 'name', team).container
    expect(name).toHaveTextContent('McLaren')
    expect(name.firstChild.firstChild).toHaveStyle({ backgroundColor: '#FF8000' })
    expect(renderCell(columns, 'color', team).container).toHaveTextContent('#FF8000')
    expect(renderCell(columns, 'drivers', team).container).toHaveTextContent('4(Ayrton, Alain...)')
    expect(renderCell(columns, 'drivers', { ...team, drivers: drivers.slice(0, 2) }).container).toHaveTextContent(
      '4(Ayrton, Alain)'
    )
  })

  test('cells of a bare team', () => {
    const bare = { ...team, img: 'https://img.test/l.png', color: null, drivers: [], _count: undefined }
    expect(renderCell(columns, 'name', bare).container.querySelector('img')).toBeInTheDocument()
    expect(renderCell(columns, 'color', bare).container.firstChild.firstChild).toHaveStyle({
      backgroundColor: '#F97316',
    })
    expect(renderCell(columns, 'drivers', bare).container.textContent).toBe('0')
  })

  test('sorting by drivers count', () => {
    expect(sortValue(columns, 'drivers', team)).toBe(4)
    expect(sortValue(columns, 'drivers', { ...team, _count: undefined })).toBe(0)
    expect(sortValue(columns, 'color', team)).toBe('#FF8000')
  })
})

describe('TeamFormModal', () => {
  test('a new team', async () => {
    const user = userEvent.setup()
    render(<TeamFormModal team={null} onClose={vi.fn()} />)
    expect(screen.getByText('New team')).toBeInTheDocument()
    await user.type(field('Name'), 'Williams')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/teams$/)
    expect(JSON.parse(options.body)).toEqual({ name: 'Williams', color: '#F97316', img: '' })
    expect(await screen.findByText('Team saved')).toBeInTheDocument()
  })

  test('editing a team', async () => {
    render(<TeamFormModal team={team} onClose={vi.fn()} />)
    expect(screen.getByText('Edit team')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('#000000'), { target: { value: '#123456' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/teams\/tm1$/)
    expect(JSON.parse(options.body)).toEqual({ name: 'McLaren', color: '#123456', img: '' })
  })
})
