import { lazy } from 'react'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddonPage from './AddonPage'
import AddonErrorBoundary from './AddonErrorBoundary'

beforeAll(() => i18n.changeLanguage('en'))

let shouldCrash
function Fragile() {
  if (shouldCrash) throw new Error('layout missing')
  return <p>planner ready</p>
}

beforeEach(() => {
  shouldCrash = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('AddonErrorBoundary', () => {
  test('shows the children when nothing goes wrong', () => {
    shouldCrash = false
    render(
      <AddonErrorBoundary addonId="planner">
        <Fragile />
      </AddonErrorBoundary>
    )
    expect(screen.getByText('planner ready')).toBeInTheDocument()
  })

  test('a crash shows the add-on, the error and a way to retry', async () => {
    render(
      <AddonErrorBoundary addonId="planner">
        <Fragile />
      </AddonErrorBoundary>
    )
    expect(screen.getByTestId('addon-error')).toHaveTextContent('The "planner" add-on crashed on this page')
    expect(screen.getByText('layout missing')).toBeInTheDocument()
    expect(console.error).toHaveBeenCalledWith('[addon:planner] page crashed:', expect.any(Error))

    shouldCrash = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('planner ready')).toBeInTheDocument()
  })

  test('a thrown value that is not an Error is shown too', () => {
    function Throws() {
      throw 'plain failure'
    }
    render(
      <AddonErrorBoundary addonId="x">
        <Throws />
      </AddonErrorBoundary>
    )
    expect(screen.getByText('plain failure')).toBeInTheDocument()
  })
})

describe('AddonPage', () => {
  const renderAt = (path, Component) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Link to="/addons/planner/other">other page</Link>
        <Routes>
          <Route path="/addons/planner/*" element={<AddonPage addonId="planner" Component={Component} />} />
        </Routes>
      </MemoryRouter>
    )

  test('renders a lazy add-on page', async () => {
    const Lazy = lazy(async () => ({ default: () => <p>lazy page</p> }))
    renderAt('/addons/planner', Lazy)
    expect(await screen.findByText('lazy page')).toBeInTheDocument()
  })

  test('a crash stays on the page, and navigating gives the add-on a fresh start', async () => {
    renderAt('/addons/planner', Fragile)
    expect(screen.getByTestId('addon-error')).toBeInTheDocument()

    shouldCrash = false
    await userEvent.click(screen.getByText('other page'))
    expect(screen.getByText('planner ready')).toBeInTheDocument()
  })
})
