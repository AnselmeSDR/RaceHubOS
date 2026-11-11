import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { io } from 'socket.io-client'
import i18n from '@/i18n'
import UpdateSection from './UpdateSection'

const socket = vi.hoisted(() => ({
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const json = (body) => ({ ok: true, json: async () => body })
const emit = (event, payload) => act(() => socket.handlers[event](payload))
let fetchMock
let reload

const API_URL = import.meta.env.VITE_API_URL || ''

/** `routes` maps a path to an answer (a function of the request options, to throw or vary); any other URL fails. */
function stubApi(routes) {
  fetchMock = vi.fn(async (url, options = {}) => {
    const key = Object.keys(routes).find(
      (path) => url === `${API_URL}${path}` && (routes[path].method ?? 'GET') === (options.method ?? 'GET')
    )
    if (!key) throw new Error(`unexpected ${url}`)
    return routes[key].answer(options)
  })
  vi.stubGlobal('fetch', fetchMock)
}
const route = (answer, method) => ({ answer: typeof answer === 'function' ? answer : async () => json(answer), method })

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  socket.handlers = {}
  socket.disconnect = vi.fn()
  reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const upToDate = { success: true, data: { currentVersion: '1.25.8', updateAvailable: false } }
const available = { success: true, data: { currentVersion: '1.25.8', updateAvailable: true, latestVersion: '1.26.0' } }

test('shows the version and that it is up to date', async () => {
  stubApi({ '/api/update/check': route(upToDate) })
  render(<UpdateSection />)
  expect(await screen.findByText('The application is up to date')).toBeInTheDocument()
  expect(screen.getByText('1.25.8')).toBeInTheDocument()
  expect(io).toHaveBeenCalledWith(import.meta.env.VITE_WS_URL || '', { transports: ['websocket', 'polling'] })
})

test('without the update check, the version comes from /health', async () => {
  stubApi({
    '/api/update/check': route(async () => Promise.reject(new Error('down'))),
    '/health': route({ version: '1.25.7' }),
  })
  render(<UpdateSection />)
  expect(await screen.findByText('1.25.7')).toBeInTheDocument()
})

test('with neither, the version stays unknown', async () => {
  stubApi({
    '/api/update/check': route(async () => Promise.reject(new Error('down'))),
    '/health': route(async () => Promise.reject(new Error('down'))),
  })
  render(<UpdateSection />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(screen.getByText('...')).toBeInTheDocument()
})

test('a refused check answer changes nothing', async () => {
  stubApi({ '/api/update/check': route({ success: false }) })
  render(<UpdateSection />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(screen.queryByText('The application is up to date')).not.toBeInTheDocument()
})

test('checking again finds a new version, or says it cannot', async () => {
  const user = userEvent.setup()
  let answer = upToDate
  stubApi({ '/api/update/check': route(async () => json(answer)) })
  render(<UpdateSection />)
  await screen.findByText('The application is up to date')

  answer = available
  await user.click(screen.getByRole('button', { name: 'Check' }))
  expect(await screen.findByText('New version available: v1.26.0')).toBeInTheDocument()

  answer = { success: false }
  await user.click(screen.getByRole('button', { name: 'Check' }))
  expect(screen.getByText('New version available: v1.26.0')).toBeInTheDocument()

  fetchMock.mockRejectedValue(new Error('down'))
  await user.click(screen.getByRole('button', { name: 'Check' }))
  expect(await screen.findByText('Unable to check')).toBeInTheDocument()
})

test('updating follows the progress, then reloads once the server is back', async () => {
  const user = userEvent.setup()
  let healthy = false
  stubApi({
    '/api/update/check': route(available),
    '/api/update/apply': route({ success: true }, 'POST'),
    '/health': route(async () => (healthy ? json({}) : Promise.reject(new Error('restarting')))),
  })
  render(<UpdateSection />)
  await user.click(await screen.findByRole('button', { name: 'Update' }))

  expect(screen.getByText('Starting...')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument()
  emit('update:progress', { step: 3, message: 'Building', status: 'running' })
  expect(screen.getByText('Building').closest('.space-y-2').querySelector('[style]')).toHaveStyle({
    width: `${(3 / 7) * 100}%`,
  })

  vi.useFakeTimers()
  emit('update:progress', { step: 7, message: 'Done', status: 'complete' })
  expect(screen.getByText('Restarting...')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(reload).not.toHaveBeenCalled()
  healthy = true
  await act(() => vi.advanceTimersByTimeAsync(2000))
  expect(reload).toHaveBeenCalledTimes(1)
})

test('losing the server mid-update means it restarts: reload when it is back', async () => {
  const user = userEvent.setup()
  stubApi({
    '/api/update/check': route(available),
    '/api/update/apply': route({ success: true }, 'POST'),
    '/health': route({}),
  })
  render(<UpdateSection />)
  await user.click(await screen.findByRole('button', { name: 'Update' }))

  vi.useFakeTimers()
  emit('disconnect')
  expect(screen.getByText('Restarting server...')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(reload).toHaveBeenCalledTimes(1)
})

test('a disconnection outside an update is ignored', async () => {
  stubApi({ '/api/update/check': route(upToDate) })
  render(<UpdateSection />)
  await screen.findByText('The application is up to date')
  emit('disconnect')
  expect(screen.queryByText('Restarting server...')).not.toBeInTheDocument()
})

test.each([
  ['refused, with its reason', route({ success: false, error: 'Local changes' }, 'POST'), 'Local changes'],
  ['refused, without reason', route({ success: false }, 'POST'), 'Error'],
  ['unreachable', route(async () => Promise.reject(new Error('down')), 'POST'), 'Server connection error'],
])('an update %s shows the error until closed', async (_, apply, message) => {
  const user = userEvent.setup()
  stubApi({ '/api/update/check': route(available), '/api/update/apply': apply })
  render(<UpdateSection />)
  await user.click(await screen.findByRole('button', { name: 'Update' }))

  expect(await screen.findByText(message)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByText(message)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument()
})

test('an update failing on the server side stops the progress', async () => {
  const user = userEvent.setup()
  stubApi({ '/api/update/check': route(available), '/api/update/apply': route({ success: true }, 'POST') })
  render(<UpdateSection />)
  await user.click(await screen.findByRole('button', { name: 'Update' }))

  emit('update:progress', { step: 4, message: 'npm install failed', status: 'error' })
  expect(screen.getByText('npm install failed')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument()
})

test('a checkout diverged from GitHub asks before replacing the local code', async () => {
  const user = userEvent.setup()
  const asked = []
  const apply = async ({ body }) => {
    const { replaceLocal } = JSON.parse(body)
    asked.push(replaceLocal)
    return json(replaceLocal ? { success: true } : { success: false, diverged: true })
  }
  stubApi({ '/api/update/check': route(available), '/api/update/apply': route(apply, 'POST') })
  render(<UpdateSection />)

  await user.click(await screen.findByRole('button', { name: 'Update' }))
  expect(await screen.findByText('Replace the local code?')).toBeInTheDocument()
  expect(screen.queryByText('Starting...')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Replace the local code?')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Update' }))
  await user.click(await screen.findByRole('button', { name: 'Replace and update' }))
  expect(screen.queryByText('Replace the local code?')).not.toBeInTheDocument()
  expect(screen.getByText('Starting...')).toBeInTheDocument()
  expect(asked).toEqual([false, false, true])
})

test('leaving the page closes the socket', () => {
  stubApi({ '/api/update/check': route(upToDate) })
  const { unmount } = render(<UpdateSection />)
  unmount()
  expect(socket.disconnect).toHaveBeenCalled()
})
