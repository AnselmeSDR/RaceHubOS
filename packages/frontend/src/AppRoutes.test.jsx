import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom'
import { coreNavItems } from '@/lib/navItems'
import AppRoutes from './AppRoutes'
import { PAGE_ROUTES } from './pageRoutes'

vi.mock('virtual:racehubos-addons', () => ({
  default: [
    {
      id: 'planner',
      web: {
        routes: [
          { path: '/', component: () => <p>planner board</p> },
          { path: 'screen', component: () => <p>planner screen</p>, layout: false },
        ],
      },
    },
  ],
}))
vi.mock('@/components/Layout', () => ({
  default: () => (
    <div data-testid="frame">
      <Outlet />
    </div>
  ),
}))
vi.mock('./pages/Dashboard', () => ({ default: () => <p>dashboard</p> }))
vi.mock('./pages/Stats', () => ({ default: () => <p>stats</p> }))

function Where() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <Where />
    </MemoryRouter>
  )

afterEach(cleanup)

test('one route per path, a page for every core menu entry', () => {
  const paths = PAGE_ROUTES.map((route) => route.path)
  expect(new Set(paths).size).toBe(paths.length)
  for (const item of coreNavItems) expect(paths).toContain(item.to.slice(1))
})

test('a core page in the frame, loaded on first visit', async () => {
  renderAt('/stats')
  expect(await screen.findByText('stats')).toBeInTheDocument()
  expect(screen.getByTestId('frame')).toContainElement(screen.getByText('stats'))
})

test("an add-on's pages in the frame or on their own", async () => {
  renderAt('/addons/planner')
  expect(await screen.findByText('planner board')).toBeInTheDocument()
  expect(screen.getByTestId('frame')).toContainElement(screen.getByText('planner board'))
  cleanup()

  renderAt('/addons/planner/screen')
  expect(await screen.findByText('planner screen')).toBeInTheDocument()
  expect(screen.queryByTestId('frame')).not.toBeInTheDocument()
})

test('an unknown address leads home', async () => {
  renderAt('/nowhere')
  expect(await screen.findByText('dashboard')).toBeInTheDocument()
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/)
})
