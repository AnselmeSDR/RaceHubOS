import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { jsonReply } from '@/test/helpers'
import Displays from './Displays'
import { COMPONENT_USAGE } from '@/components/displays/componentUsage'

vi.mock('@/context/AppContext', () => ({ useApp: () => ({ isDark: false }) }))

const drivers = [
  {
    id: 'd1',
    name: 'Ayrton',
    color: '#FFCC00',
    number: 12,
    divisions: [{ id: 'gold', name: 'GOLD', color: '#F5D13C', scope: 'driver' }],
  },
  { id: 'd2', name: 'Alain', color: '#3B82F6', number: 2 },
  { id: 'd3', name: 'Nigel', color: '#EF4444', number: 5 },
  { id: 'd4', name: 'Nelson', color: '#22C55E', number: 6 },
]
const cars = [
  { id: 'c1', brand: 'Porsche', model: '911', color: '#FF0000' },
  { id: 'c2', brand: 'Ferrari', model: 'F40', color: '#DC2626' },
]
let fetchMock

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async (url) => {
    if (url.endsWith('/drivers')) return jsonReply({ success: true, data: drivers })
    if (url.endsWith('/cars')) return jsonReply({ success: true, data: cars })
    return jsonReply({ success: false })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <Displays />
    </MemoryRouter>
  )

test('loads sample drivers and cars only', async () => {
  renderPage()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    expect.stringMatching(/\/drivers$/),
    expect.stringMatching(/\/cars$/),
  ])
})

test.each(['Drivers', 'Championship', 'Race', 'CRUD', 'Config', 'Unused'])(
  'the %s tab shows its components',
  async (tab) => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await user.click(within(screen.getByTestId('display-tabs')).getByRole('button', { name: tab }))
    // Every tab is made of sections, each naming its component and the pages using it
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.length).toBeGreaterThan(0)
  }
)

test('each section says which pages use its component, or that none does', async () => {
  renderPage()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const section = (name) => screen.getByText(`<${name} />`, { exact: false }).parentElement
  // The drivers tab is open first
  expect(section('DriverProfileHeader')).toHaveTextContent(COMPONENT_USAGE.DriverProfileHeader[0])
  expect(within(section('DriverBadge')).getByText(i18n.t('displays:usage.unused'))).toBeInTheDocument()
})

test('without data, the tabs still load', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fetchMock.mockRejectedValue(new Error('down'))
  renderPage()
  await waitFor(() => expect(console.error).toHaveBeenCalledWith('Failed to load data:', expect.any(Error)))
  expect(screen.getByTestId('display-tabs')).toBeInTheDocument()
})

test('an empty answer leaves empty samples', async () => {
  fetchMock.mockResolvedValue(jsonReply({ success: true }))
  renderPage()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(screen.getByTestId('display-tabs')).toBeInTheDocument()
})

test('driver cards are selected and unselected on click', async () => {
  const user = userEvent.setup()
  renderPage()
  const [ayrton] = await screen.findAllByTestId('driver-select-card')
  await user.click(ayrton)
  expect(ayrton).toHaveClass('ring-4')
  await user.click(ayrton)
  expect(ayrton).not.toHaveClass('ring-4')
})

test.each(['Free Practice', 'Qualifying', 'Race'])(
  'the championship leaderboard follows the %s type',
  async (label) => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await user.click(within(screen.getByTestId('display-tabs')).getByRole('button', { name: 'Championship' }))
    const typeButton = screen
      .getAllByRole('button', { name: label })
      .find((b) => !b.closest('[data-testid="display-tabs"]'))
    await user.click(typeButton)
    expect(typeButton).toHaveClass('text-white')
  }
)
