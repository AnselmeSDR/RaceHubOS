import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '@/i18n'
import { PageHeaderProvider } from '@/context/PageHeaderContext'
import { routeFetch } from '@/test/helpers'
import Stats from './Stats'

const laps = [
  { id: 'l1', lapTime: 7000, driver: { id: 'd1', name: 'Ana' }, car: { id: 'c1', brand: 'Ferrari', model: '499P' } },
  { id: 'l2', lapTime: 7100, driver: { id: 'd2', name: 'Ben' }, car: { id: 'c1', brand: 'Ferrari', model: '499P' } },
]
let mock

const lapQueries = () =>
  mock.mock.calls
    .filter(([url, init]) => url.startsWith('/api/stats/laptimes') && !init?.method)
    .map(([url]) => Object.fromEntries(new URL(url, 'http://x').searchParams))

function renderPage() {
  return render(
    <PageHeaderProvider>
      <MemoryRouter initialEntries={['/stats']}>
        <Routes>
          <Route path="/stats" element={<Stats />} />
          <Route path="/drivers/:id" element={<div data-testid="driver-page" />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>
  )
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  mock = routeFetch({
    '/api/stats/laptimes': { success: true, data: laps, total: 2, hasMore: false },
    '/api/drivers': {
      success: true,
      data: [
        { id: 'd1', name: 'Ana' },
        { id: 'd2', name: 'Ben' },
      ],
    },
    '/api/cars': { success: true, data: [{ id: 'c1', brand: 'Ferrari', model: '499P' }] },
    '/api/tracks': { success: true, data: [] },
    '/api/championships': { success: true, data: [{ id: 'ch1', name: 'Winter Cup' }] },
    '/api/preferences': { success: false },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function shown() {
  renderPage()
  await screen.findByText('7.000s')
}

test('the laps, best per driver and car by default', async () => {
  await shown()
  expect(screen.getByText('7.100s')).toBeInTheDocument()
  expect(lapQueries()[0]).toEqual({ unique: 'true', offset: '0', limit: '50' })
})

test('filtering by driver keeps the menu open and reloads with the filter', async () => {
  await shown()
  const driverHeader = screen.getByRole('columnheader', { name: /Driver/ })
  await userEvent.click(within(driverHeader).getByRole('button'))
  await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Ana' }))
  await waitFor(() => expect(lapQueries().at(-1)).toMatchObject({ driverId: 'd1', offset: '0' }))
  // Still open: a second driver can be added
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Ben' }))
  await waitFor(() => expect(lapQueries().at(-1)).toMatchObject({ driverId: 'd1,d2' }))
})

test('the championship filter offers laps outside championships', async () => {
  await shown()
  const header = screen.getByRole('columnheader', { name: /Championship/ })
  await userEvent.click(within(header).getByRole('button'))
  expect(await screen.findByRole('menuitemcheckbox', { name: 'Winter Cup' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Outside championship' }))
  await waitFor(() => expect(lapQueries().at(-1)).toMatchObject({ championshipId: 'none' }))
})

test('a driver cell opens the driver', async () => {
  await shown()
  await userEvent.click(screen.getByText('Ana'))
  expect(screen.getByTestId('driver-page')).toBeInTheDocument()
})

test('every lap, or the deleted ones, from the options', async () => {
  await shown()
  await userEvent.click(screen.getByText('Best per driver/car'))
  await waitFor(() => expect(lapQueries().at(-1)).toMatchObject({ unique: 'false' }))
  await userEvent.click(screen.getByText('Show deleted items'))
  await waitFor(() => expect(lapQueries().at(-1)).toMatchObject({ unique: 'false', deleted: 'true' }))
})

test('the filters stay empty when their lists cannot be read', async () => {
  routeFetch({
    '/api/stats/laptimes': { success: true, data: laps, total: 2, hasMore: false },
    '/api/drivers': { success: false },
    '/api/championships': { success: false },
  })
  await shown()
  const header = screen.getByRole('columnheader', { name: /Championship/ })
  await userEvent.click(within(header).getByRole('button'))
  await screen.findByRole('menuitemcheckbox', { name: 'Outside championship' })
  expect(screen.getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual([
    'Tous',
    'Outside championship',
  ])
})
