import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { PageHeaderProvider, usePageHeader } from '@/context/PageHeaderContext'
import { routeFetch } from '@/test/helpers'
import SessionsList from './SessionsList'

const { form } = vi.hoisted(() => ({ form: {} }))
vi.mock('@/components/SessionForm', () => ({
  default: (props) => {
    form.props = props
    return <div data-testid="session-form" />
  },
}))

const sessions = [{ id: 's1', name: 'Grand Prix', type: SessionType.RACE, status: SessionStatus.FINISHED }]
let mock

const listQueries = () =>
  mock.mock.calls
    .filter(([url, init]) => new URL(url, 'http://x').pathname === '/api/sessions' && !init?.method)
    .map(([url]) => Object.fromEntries(new URL(url, 'http://x').searchParams))

/** What the layout shows of the page header: its add button. */
function HeaderAddButton() {
  const { header } = usePageHeader()
  return header?.onAdd ? <button onClick={header.onAdd}>{header.addLabel}</button> : null
}

function renderPage() {
  return render(
    <PageHeaderProvider>
      <HeaderAddButton />
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/history" element={<SessionsList />} />
          <Route path="/sessions/:id" element={<div data-testid="session-page" />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>
  )
}

async function shown() {
  renderPage()
  await screen.findByText('Grand Prix')
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  mock = routeFetch({
    '/api/sessions': { success: true, data: sessions, total: 1, hasMore: false },
    '/api/tracks': { success: true, data: [{ id: 't1', name: 'Monza' }] },
    '/api/championships': { success: true, data: [{ id: 'c1', name: 'Winter Cup' }] },
    '/api/preferences': { success: false },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('a session opens its page', async () => {
  await shown()
  expect(listQueries()[0]).toEqual({ offset: '0', limit: '50' })
  await userEvent.click(screen.getByText('Grand Prix'))
  expect(screen.getByTestId('session-page')).toBeInTheDocument()
})

test('a deleted session does not open', async () => {
  await shown()
  await userEvent.click(screen.getByText('Show deleted items'))
  await waitFor(() => expect(listQueries().at(-1)).toMatchObject({ deleted: 'true' }))
  await userEvent.click(screen.getByText('Grand Prix'))
  expect(screen.queryByTestId('session-page')).not.toBeInTheDocument()
})

test.each([
  ['Type', 'Qualifying', { type: SessionType.QUALIF }],
  ['Track', 'Monza', { trackId: 't1' }],
  ['Status', 'In progress', { status: SessionStatus.ACTIVE }],
  ['Championship', 'No championship', { championshipId: 'null' }],
  ['Championship', 'Winter Cup', { championshipId: 'c1' }],
])('the %s filter reloads with %s', async (columnName, option, expected) => {
  await shown()
  const header = screen.getByRole('columnheader', { name: new RegExp(columnName) })
  await userEvent.click(within(header).getByRole('button'))
  await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: option }))
  await waitFor(() => expect(listQueries().at(-1)).toMatchObject(expected))
})

test('the filters offer no track nor championship when their lists cannot be read', async () => {
  routeFetch({
    '/api/sessions': { success: true, data: sessions, total: 1, hasMore: false },
    '/api/tracks': new Error('offline'),
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await shown()
  const header = screen.getByRole('columnheader', { name: /Championship/ })
  await userEvent.click(within(header).getByRole('button'))
  await screen.findByRole('menuitemcheckbox', { name: 'No championship' })
  expect(screen.queryByRole('menuitemcheckbox', { name: 'Winter Cup' })).not.toBeInTheDocument()
  vi.restoreAllMocks()
})

test('a new session from the header; saving it reloads the list', async () => {
  await shown()
  await userEvent.click(screen.getByRole('button', { name: 'New session' }))
  expect(screen.getByTestId('session-form')).toBeInTheDocument()
  const before = listQueries().length
  act(() => form.props.onSaved())
  expect(screen.queryByTestId('session-form')).not.toBeInTheDocument()
  await waitFor(() => expect(listQueries().length).toBe(before + 1))
})

test('closing the form reloads nothing', async () => {
  await shown()
  await userEvent.click(screen.getByRole('button', { name: 'New session' }))
  const before = listQueries().length
  act(() => form.props.onClose())
  expect(screen.queryByTestId('session-form')).not.toBeInTheDocument()
  expect(listQueries().length).toBe(before)
})
