import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ApplicationPanel from './ApplicationPanel'

const { app } = vi.hoisted(() => ({ app: {} }))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))
vi.mock('./UpdateSection', () => ({ default: () => <div data-testid="settings-update" /> }))

beforeAll(() => i18n.changeLanguage('en'))

test('the version and its updates, then the admin mode, which says what it opens', async () => {
  Object.assign(app, { isAdmin: true, toggleAdmin: vi.fn() })
  render(<ApplicationPanel />)
  expect(screen.getByRole('heading', { name: 'Application' })).toBeInTheDocument()
  expect(screen.getByTestId('settings-update')).toBeInTheDocument()
  expect(screen.getByText('Displays, Test, Simulator')).toBeInTheDocument()
  const admin = screen.getByRole('switch', { name: 'Administrator mode' })
  expect(admin).toHaveAttribute('aria-checked', 'true')
  await userEvent.click(admin)
  expect(app.toggleAdmin).toHaveBeenCalled()
})
