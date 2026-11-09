import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import Settings from './Settings'

const { sockets, device } = vi.hoisted(() => ({ sockets: [], device: {} }))
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = {
      handlers: {},
      on(event, handler) {
        this.handlers[event] = handler
      },
      disconnect: vi.fn(),
    }
    sockets.push(socket)
    return socket
  }),
}))
vi.mock('@/context/DeviceContext', () => ({ SIMULATOR_ADDRESS: 'SIMULATOR', useDevice: () => device }))
vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ isDark: false, toggleTheme: vi.fn(), isAdmin: false, toggleAdmin: vi.fn() }),
}))
vi.mock('@/context/VoiceContext', () => ({
  useVoice: () => ({ bestLapEnabled: false, podiumEnabled: false, minLaps: 3, voiceId: '' }),
}))

const timer = (payload) => act(() => sockets.find((s) => s.handlers['cu:timer']).handlers['cu:timer'](payload))
const logLines = () => within(screen.getByTestId('settings-logs')).queryAllByText(/^Ctrl|^Scanning|found$/)

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  sockets.length = 0
  Object.assign(device, {
    connected: false,
    devices: [],
    scanResults: [],
    scanning: false,
    connecting: false,
    scan: vi.fn(async () => []),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ success: false }) }))
  )
  vi.stubGlobal('speechSynthesis', { getVoices: () => [], addEventListener() {}, removeEventListener() {} })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('every section is on the page', () => {
  render(<Settings />)
  for (const section of ['update', 'connection', 'devices', 'appearance', 'voice', 'reference-driver', 'logs']) {
    expect(screen.getByTestId(`settings-${section}`)).toBeInTheDocument()
  }
  expect(screen.getByText('No logs')).toBeInTheDocument()
})

test('laps and sectors of the Control Unit go to the log', () => {
  render(<Settings />)
  timer({ controller: 0, isFinishLine: true, lapTime: 6142 })
  timer({ controller: 2, isFinishLine: false, sector: 2 })
  // A finish-line pass without a time (first crossing) is not a lap
  timer({ controller: 1, isFinishLine: true, lapTime: 0 })
  expect(logLines().map((line) => line.textContent)).toEqual(['Ctrl 1: 6.142s', 'Ctrl 3: sector 2'])
})

test('the device steps go to the log, and the log clears', async () => {
  render(<Settings />)
  await userEvent.click(screen.getByRole('button', { name: 'Search for a new track' }))
  expect(logLines().map((line) => line.textContent)).toEqual(['Scanning...', '0 device(s) found'])

  await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByText('No logs')).toBeInTheDocument()
})

test('the log keeps the last hundred lines, scrolled to the end', () => {
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(480)
  const scrolled = vi.spyOn(Element.prototype, 'scrollTop', 'set')
  render(<Settings />)
  for (let i = 0; i < 105; i++) timer({ controller: 0, isFinishLine: false, sector: i })
  const lines = logLines()
  expect(lines).toHaveLength(100)
  expect(lines[0]).toHaveTextContent('sector 5')
  expect(scrolled).toHaveBeenLastCalledWith(480)
  expect(scrolled.mock.contexts.at(-1)).toBe(screen.getByTestId('settings-logs').lastElementChild)
})

test('leaving the page closes its sockets', () => {
  const { unmount } = render(<Settings />)
  unmount()
  for (const socket of sockets) expect(socket.disconnect).toHaveBeenCalled()
})
