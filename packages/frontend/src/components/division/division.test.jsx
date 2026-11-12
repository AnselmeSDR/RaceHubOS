import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChampionshipStatus } from '@racehubos/shared'
import i18n from '@/i18n'
import { field, jsonReply, routeFetch, withStatus } from '@/test/helpers'
import DivisionBadge from './DivisionBadge'
import DivisionCard from './DivisionCard'
import DivisionChampionships from './DivisionChampionships'
import DivisionFormModal from './DivisionFormModal'
import DivisionIdentity from './DivisionIdentity'
import DivisionMembers from './DivisionMembers'

const people = (n) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, name: `Driver ${i}` }))
const cars = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, brand: 'Audi', model: `R${i}`, img: `c${i}.png` }))

let fetchMock
beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async () => jsonReply({ success: true, data: {} }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DivisionCard', () => {
  test('a driver division: its short name as logo, its rank, its first drivers and how many more', () => {
    const gold = { id: 'g', name: 'Gold league', shortName: 'GOLD', color: '#F5D13C', scope: 'driver', order: 1 }
    render(<DivisionCard division={{ ...gold, drivers: people(3), _count: { drivers: 5 } }} onClick={vi.fn()} />)
    const card = screen.getByTestId('entity-card')
    expect(within(card).getByText('Rank 1')).toBeInTheDocument()
    expect(within(card).getByRole('heading', { name: 'Gold league' })).toBeInTheDocument()
    expect(within(card).getAllByText(/^Driver \d$/)).toHaveLength(3)
    expect(card).toHaveTextContent('+2 more')
  })

  test('a category: its first cars pictured, "more" under them; none yet', () => {
    const gt3 = { id: 'gt3', name: 'GT3', color: '#E11D48', scope: 'car', order: 2 }
    render(<DivisionCard division={{ ...gt3, cars: cars(3), _count: { cars: 4 } }} onClick={vi.fn()} />)
    expect(screen.getByText('Order 2')).toBeInTheDocument()
    const pictures = screen.getAllByRole('img', { name: /^Audi R\d$/ })
    expect(pictures).toHaveLength(3)
    expect(screen.getByText('+1 more').previousElementSibling).toContainElement(pictures[0])
    cleanup()
    render(<DivisionCard division={{ ...gt3, cars: [], _count: { cars: 0 } }} onClick={vi.fn()} />)
    expect(screen.getByText('No cars')).toBeInTheDocument()
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })
})

describe('DivisionBadge', () => {
  test('a dark category stays readable on the dark theme, outlined on a transparent background', () => {
    render(<DivisionBadge division={{ id: 'k', name: 'Classic', scope: 'car', color: '#1E293B' }} />)
    const badge = screen.getByTitle('Classic')
    expect(badge.style.backgroundColor).toBe('')
    expect(badge.style.getPropertyValue('--ink')).toBe('#1E293B')
    expect(badge.style.getPropertyValue('--ink-dark')).toBe('#e7e5e4')
  })
})

describe('DivisionFormModal', () => {
  const sent = () => fetchMock.mock.calls.find(([, options]) => options?.method)

  test('a new category without an order is created last, the server deciding', async () => {
    const user = userEvent.setup()
    render(<DivisionFormModal division={null} scope="car" onClose={vi.fn()} />)
    expect(screen.getByText('New category')).toBeInTheDocument()
    await user.type(field('Name'), 'GT3')
    expect(within(screen.getByTestId('division-preview')).getAllByText('GT3')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent()).toBeDefined())
    const [url, options] = sent()
    expect(url).toMatch(/\/api\/divisions$/)
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({ scope: 'car', name: 'GT3', color: '#6B7280' })
    expect(body).not.toHaveProperty('order')
  })

  test('a division edited keeps its rank, sent as a number, 0 included', async () => {
    const user = userEvent.setup()
    const silver = { id: 'dv2', name: 'SILVER', color: '#C4C4C4', scope: 'driver', order: 2 }
    render(<DivisionFormModal division={silver} scope="driver" onClose={vi.fn()} />)
    expect(screen.getByText('Edit division')).toBeInTheDocument()
    await user.clear(field('Rank'))
    await user.type(field('Rank'), '0')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent()).toBeDefined())
    const [url, options] = sent()
    expect(url).toMatch(/\/api\/divisions\/dv2$/)
    expect(JSON.parse(options.body)).toMatchObject({ name: 'SILVER', order: 0 })
  })

  test('a negative or decimal rank is refused in the language of the interface, nothing sent', async () => {
    const user = userEvent.setup()
    const silver = { id: 'dv2', name: 'SILVER', color: '#C4C4C4', scope: 'driver', order: 2 }
    render(<DivisionFormModal division={silver} scope="driver" onClose={vi.fn()} />)
    for (const value of ['-1', '1.5']) {
      fireEvent.change(field('Rank'), { target: { value } })
      expect(screen.getByText('A whole number, 0 or more.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(sent()).toBeUndefined()
    }
  })
})

const GOLD = { id: 'gold', name: 'GOLD', scope: 'driver', order: 2, color: '#F5D13C' }
const INVITE = { id: 'invite', name: 'INVITÉ', scope: 'driver', color: '#424242' }
const GT3 = { id: 'gt3', name: 'GT3', scope: 'car', order: 1, color: '#E11D48' }
const ana = {
  id: 'ana',
  name: 'Ana',
  number: 7,
  races: 12,
  wins: 3,
  podiums: 5,
  bestLap: 8123,
  since: '2026-11-12T10:00:00.000Z',
  divisions: [GOLD, INVITE],
}
const gold = { ...GOLD, drivers: [ana], cars: [], championships: [] }
const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('DivisionIdentity', () => {
  test('name, badge, rank, then its members and championships counted', () => {
    inRouter(<DivisionIdentity division={{ ...gold, championships: [{ id: 'c1' }, { id: 'c2' }] }} />)
    const identity = screen.getByTestId('division-identity')
    expect(within(identity).getByRole('heading', { name: 'GOLD' })).toBeInTheDocument()
    expect(identity).toHaveTextContent('Rank 2')
    expect(identity).toHaveTextContent('1 driver')
    expect(identity).toHaveTextContent('2 championships')
  })
})

describe('DivisionMembers', () => {
  const others = [
    { id: 'ben', name: 'Ben' },
    { id: 'ana', name: 'Ana' },
    { id: 'abe', name: 'Abe' },
  ]

  test('each driver: link to their page, their other divisions, figures and join date', () => {
    routeFetch({ '/api/drivers': { success: true, data: others } })
    inRouter(<DivisionMembers division={gold} onChange={vi.fn()} />)
    const row = screen.getByTestId('division-member')
    expect(within(row).getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/drivers/ana')
    // This division's badge is the page's own: only the others are shown
    expect(
      within(row)
        .getAllByTestId('division-badge')
        .map((b) => b.textContent)
    ).toEqual(['INVITÉ'])
    // Races, wins, podiums, record
    expect(
      within(row)
        .getAllByTestId('division-member-figure')
        .map((f) => f.textContent)
    ).toEqual(['12', '3', '5', '8.123'])
    expect(row).toHaveTextContent(new Date(ana.since).toLocaleDateString('en'))
  })

  test('a driver not in it is added; the division comes back', async () => {
    const changed = { ...gold, drivers: [ana, { ...others[2], since: ana.since }] }
    const mock = routeFetch({
      '/api/drivers': { success: true, data: others },
      'POST /api/divisions/gold/members': { success: true, data: changed },
    })
    const onChange = vi.fn()
    inRouter(<DivisionMembers division={gold} onChange={onChange} />)
    const add = screen.getByRole('combobox', { name: 'Add a driver…' })
    await waitFor(() => expect(within(add).getAllByRole('option')).toHaveLength(3))
    expect(
      within(add)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Add a driver…', 'Abe', 'Ben'])
    await userEvent.selectOptions(add, 'abe')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(changed))
    const [, init] = mock.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(JSON.parse(init.body)).toEqual({ memberId: 'abe' })
  })

  test('a driver is removed by their cross; a refusal is shown', async () => {
    const mock = routeFetch({
      '/api/drivers': { success: true, data: others },
      'DELETE /api/divisions/gold/members/ana': { success: true, data: { ...gold, drivers: [] } },
    })
    const onChange = vi.fn()
    inRouter(<DivisionMembers division={gold} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Ana' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...gold, drivers: [] }))
    expect(mock.mock.calls.some(([url, o]) => o?.method === 'DELETE' && url.endsWith('/members/ana'))).toBe(true)
    cleanup()
    routeFetch({
      '/api/drivers': { success: true, data: others },
      'DELETE /api/divisions/gold/members/ana': withStatus(404, { error: 'Division not found' }),
    })
    inRouter(<DivisionMembers division={gold} onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Ana' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Division not found')
  })

  test('a category lists its cars by brand and model, and offers the other cars', async () => {
    const audi = { id: 'audi', brand: 'Audi', model: 'R8', year: 2019, since: ana.since, races: 4, divisions: [GT3] }
    routeFetch({ '/api/cars': { success: true, data: [audi, { id: 'bmw', brand: 'BMW', model: 'M4' }] } })
    inRouter(<DivisionMembers division={{ ...GT3, drivers: [], cars: [audi], championships: [] }} onChange={vi.fn()} />)
    const row = screen.getByTestId('division-member')
    expect(within(row).getByRole('link', { name: 'Audi R8' })).toHaveAttribute('href', '/cars/audi')
    expect(row).toHaveTextContent('2019')
    expect(within(row).queryByTestId('division-badge')).not.toBeInTheDocument()
    const add = screen.getByRole('combobox', { name: 'Add a car…' })
    await waitFor(() =>
      expect(
        within(add)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual(['Add a car…', 'BMW M4'])
    )
  })

  test('none yet; a division in the bin takes no one', () => {
    routeFetch({ '/api/drivers': { success: true, data: others } })
    inRouter(<DivisionMembers division={{ ...gold, drivers: [], deletedAt: '2026-11-12' }} onChange={vi.fn()} />)
    expect(screen.getByText('No drivers')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('DivisionChampionships', () => {
  test('each championship opens, with its track, season, filters and status; none yet', () => {
    const cup = {
      id: 'c1',
      name: 'Cup',
      season: '2026',
      status: ChampionshipStatus.ACTIVE,
      track: { name: 'Monza' },
      divisions: [GOLD, GT3],
    }
    inRouter(<DivisionChampionships division={{ ...gold, championships: [cup] }} />)
    const link = screen.getByRole('link', { name: /Cup/ })
    expect(link).toHaveAttribute('href', '/championships/c1')
    expect(link).toHaveTextContent('Monza · 2026')
    expect(
      within(link)
        .getAllByTestId('division-badge')
        .map((b) => b.textContent)
    ).toEqual(['GOLD', 'GT3'])
    cleanup()
    inRouter(<DivisionChampionships division={gold} />)
    expect(screen.getByText('No championship is run for this division.')).toBeInTheDocument()
  })
})
