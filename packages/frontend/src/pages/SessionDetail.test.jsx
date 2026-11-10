import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import SessionDetail from './SessionDetail'

const { received, spy } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => ({
    default: (props) => {
      received[name] = props
      return <div data-testid={name} />
    },
  })
  return { received, spy }
})
vi.mock('@/components/sessionDetail/SessionDetailHeader', () => spy('SessionDetailHeader'))
vi.mock('@/components/sessionDetail/SessionPodiumCard', () => spy('SessionPodiumCard'))
vi.mock('@/components/sessionDetail/SessionDnfList', () => spy('SessionDnfList'))
vi.mock('@/components/sessionDetail/SessionResults', () => spy('SessionResults'))
vi.mock('@/components/sessionDetail/SessionLapHistory', () => spy('SessionLapHistory'))

const session = {
  id: 's1',
  type: SessionType.QUALIF,
  status: SessionStatus.FINISHED,
  drivers: [
    { id: 'b', bestLapTime: 8200 },
    { id: 'a', bestLapTime: 8000 },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/history/s1']}>
      <Routes>
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/history" element={<div data-testid="history" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('a spinner, then every block with the whole session and its ranked entries', async () => {
  routeFetch({ '/api/sessions/s1': { success: true, data: session } })
  const { container } = renderPage()
  expect(container.querySelector('.animate-spin')).not.toBeNull()
  await screen.findByTestId('SessionDetailHeader')
  const blocks = [...container.querySelectorAll('[data-testid^="Session"]')].map((n) => n.dataset.testid)
  expect(blocks).toEqual([
    'SessionDetailHeader',
    'SessionPodiumCard',
    'SessionDnfList',
    'SessionResults',
    'SessionLapHistory',
  ])
  for (const name of ['SessionDetailHeader', 'SessionPodiumCard', 'SessionResults', 'SessionLapHistory']) {
    expect(received[name].session).toEqual(session)
  }
  expect(received.SessionResults.entries.map((e) => e.id)).toEqual(['a', 'b'])
  expect(received.SessionDnfList.entries).toBe(received.SessionResults.entries)
})

test.each([
  ['an unknown session', { success: false }],
  ['an unreachable server', new Error('offline')],
])('not found for %s, with a way back', async (_, reply) => {
  routeFetch({ '/api/sessions/s1': reply })
  renderPage()
  expect(await screen.findByText('Session not found')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Back/ }))
  expect(screen.getByTestId('history')).toBeInTheDocument()
})

test('back from the header', async () => {
  routeFetch({ '/api/sessions/s1': { success: true, data: session } })
  renderPage()
  await screen.findByTestId('SessionDetailHeader')
  act(() => received.SessionDetailHeader.onBack())
  expect(screen.getByTestId('history')).toBeInTheDocument()
})

test('deleting goes back to the history', async () => {
  const mock = routeFetch({ '/api/sessions/s1': { success: true, data: session }, 'DELETE /api/sessions/s1': {} })
  renderPage()
  await screen.findByTestId('SessionDetailHeader')
  await act(() => received.SessionDetailHeader.onDelete())
  expect(mock).toHaveBeenCalledWith('/api/sessions/s1', { method: 'DELETE' })
  expect(screen.getByTestId('history')).toBeInTheDocument()
})

test('a refused or failed deletion stays on the session', async () => {
  routeFetch({ '/api/sessions/s1': { success: true, data: session }, 'DELETE /api/sessions/s1': 500 })
  renderPage()
  await screen.findByTestId('SessionDetailHeader')
  await act(() => received.SessionDetailHeader.onDelete())
  expect(screen.queryByTestId('history')).not.toBeInTheDocument()
  routeFetch({ 'DELETE /api/sessions/s1': new Error('offline') })
  await act(() => received.SessionDetailHeader.onDelete())
  expect(console.error).toHaveBeenCalledWith('Error deleting session:', expect.any(Error))
  expect(screen.queryByTestId('history')).not.toBeInTheDocument()
})
