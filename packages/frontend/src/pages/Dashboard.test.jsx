import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import { jsonReply } from '@/test/helpers'
import Dashboard from './Dashboard'

vi.mock('@/context/SessionContext', () => ({ useSession: () => ({ session: { name: 'GP' }, isActive: true }) }))
vi.mock('@/context/DeviceContext', () => ({ useDevice: () => ({ connected: true, socketConnected: true }) }))

const driver = { id: 1, name: 'Ana' }
const replies = {
  '/api/stats/records': { success: true, data: { mostWins: { driver, count: 3 } } },
  '/api/stats/drivers': { success: true, data: [driver] },
  '/api/stats/laptimes': { success: true, data: [{ driver, lapTime: 7000 }] },
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const key = Object.keys(replies).find((k) => url.startsWith(k))
      return jsonReply(key ? replies[key] : { count: 1 })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('every block of the home page, in order', async () => {
  const { container } = render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
  await screen.findByTestId('dashboard-records')
  await screen.findByTestId('dashboard-driver-leaderboard')
  await screen.findByTestId('dashboard-top-laps')
  const order = [...container.querySelectorAll('[data-testid^="dashboard-"]')].map((n) => n.dataset.testid)
  expect(order).toEqual([
    'dashboard-active-session',
    'dashboard-stats',
    'dashboard-records',
    'dashboard-driver-leaderboard',
    'dashboard-top-laps',
    'dashboard-quick-actions',
    'dashboard-system',
  ])
})
