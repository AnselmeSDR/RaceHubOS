import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CarProfile from './CarProfile'
import DriverProfile from './DriverProfile'
import TrackProfile from './TrackProfile'

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const json = (body) => ({ ok: true, status: 200, json: async () => body })

const profiles = [
  {
    name: 'car',
    Page: CarProfile,
    list: '/cars',
    record: { id: 'c1', brand: 'Porsche', model: '911', sessions: [], records: [] },
    heading: 'Porsche 911',
    notFound: 'Car not found',
  },
  {
    name: 'track',
    Page: TrackProfile,
    list: '/tracks',
    record: { id: 't1', name: 'Monza', bestLap: 9876, sessions: [], records: [] },
    heading: 'Monza',
    notFound: 'Track not found',
  },
  {
    name: 'driver',
    Page: DriverProfile,
    list: '/drivers',
    record: { id: 'd1', name: 'Ayrton', sessions: [], records: [{ id: 'r1', lapTime: 7654 }] },
    heading: 'Ayrton',
    notFound: 'Driver not found',
  },
]

/** Answers the profile's own record (or a 404), and an empty success everywhere else. */
function stubApi({ list, record }, { found = true } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith(`/api${list}/${record.id}`) && !options.method) {
      return found ? json({ success: true, data: record }) : { ok: false, status: 404 }
    }
    return json({ success: true, data: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const calls = (fetchMock, pattern, method) =>
  fetchMock.mock.calls.filter(([url, options = {}]) => pattern.test(url) && options.method === method)

function renderProfile({ Page, list, record }) {
  return render(
    <MemoryRouter initialEntries={[`${list}/${record.id}`]}>
      <Routes>
        <Route path={`${list}/:id`} element={<Page />} />
        <Route path={list} element={<p>the list</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe.each(profiles)('$name profile', (profile) => {
  const { name, list, record, heading, notFound } = profile

  test('shows the identity, actions and recent sessions of the record', async () => {
    stubApi(profile)
    renderProfile(profile)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    for (const part of ['identity', 'profile-actions', 'recent-sessions']) {
      expect(screen.getByTestId(`${name}-${part}`)).toBeInTheDocument()
    }
    expect(screen.getByText('Top 10 Records')).toBeInTheDocument()
  })

  test('an unknown id says so and leads back to the list', async () => {
    stubApi(profile, { found: false })
    renderProfile(profile)
    expect(await screen.findByText(notFound)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('the list')).toBeInTheDocument()
  })

  test('the arrow in the header leads back to the list', async () => {
    stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('the list')).toBeInTheDocument()
  })

  test('a failed request leaves the not-found message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline')))
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderProfile(profile)
    expect(await screen.findByText(notFound)).toBeInTheDocument()
  })

  test('resetting the stats asks first, then reloads the record', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })
    const reset = within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[1]

    await user.click(reset)
    expect(screen.getByText('Reset statistics')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(calls(fetchMock, new RegExp(`/api${list}/${record.id}/reset-stats$`), 'POST')).toHaveLength(1)
    await waitFor(() => expect(calls(fetchMock, new RegExp(`/api${list}/${record.id}$`), undefined)).toHaveLength(2))
    expect(screen.queryByText('Reset statistics')).not.toBeInTheDocument()
  })

  test('cancelling the reset sends nothing', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })

    await user.click(within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[1])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Reset statistics')).not.toBeInTheDocument()
    expect(calls(fetchMock, /reset-stats$/, 'POST')).toHaveLength(0)
  })

  test('a refused reset does not reload the record', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })
    const original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(async (url, options) =>
      url.endsWith('/reset-stats') ? { ok: false, status: 500 } : original(url, options)
    )

    await user.click(within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[1])
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() =>
      expect(within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[1]).toBeEnabled()
    )
    expect(calls(fetchMock, new RegExp(`/api${list}/${record.id}$`), undefined)).toHaveLength(1)
  })

  test('a failed reset keeps the page', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })
    fetchMock.mockImplementation(async () => Promise.reject(new Error('offline')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await user.click(within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[1])
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() =>
      expect(within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[1]).toBeEnabled()
    )
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  test('editing opens the form; closing it reloads the record', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })

    await user.click(within(screen.getByTestId(`${name}-profile-actions`)).getAllByRole('button')[0])
    const modal = screen.getByTestId('modal')
    await user.click(within(modal).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    await waitFor(() => expect(calls(fetchMock, new RegExp(`/api${list}/${record.id}$`), undefined)).toHaveLength(2))
  })

  test('deleting removes the record and goes back to the list', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi(profile)
    renderProfile(profile)
    await screen.findByRole('heading', { name: heading })

    await user.click(screen.getByTestId('delete-button'))
    await user.click(screen.getByTestId('delete-button'))

    expect(await screen.findByText('the list')).toBeInTheDocument()
    expect(calls(fetchMock, new RegExp(`/api${list}/${record.id}$`), 'DELETE')).toHaveLength(1)
  })
})

describe('driver profile teams', () => {
  const driverProfile = profiles.find((p) => p.name === 'driver')

  test.each([
    ['refused', async () => json({ success: false })],
    ['empty', async () => json({ success: true })],
    ['unreachable', async () => Promise.reject(new Error('offline'))],
  ])('the teams list %s: the profile still shows', async (_, teamsAnswer) => {
    const fetchMock = stubApi(driverProfile)
    const original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url, options) =>
      url.endsWith('/api/teams') ? teamsAnswer() : original(url, options)
    )
    renderProfile(driverProfile)
    expect(await screen.findByRole('heading', { name: 'Ayrton' })).toBeInTheDocument()
  })

  test('the edit form lists the teams', async () => {
    const fetchMock = stubApi(driverProfile)
    const original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(async (url, options) =>
      url.endsWith('/api/teams')
        ? json({ success: true, data: [{ id: 'tm1', name: 'McLaren' }] })
        : original(url, options)
    )
    renderProfile(driverProfile)
    await screen.findByRole('heading', { name: 'Ayrton' })
    await userEvent.click(within(screen.getByTestId('driver-profile-actions')).getAllByRole('button')[0])
    expect(within(screen.getByTestId('modal')).getByText('McLaren')).toBeInTheDocument()
  })
})
