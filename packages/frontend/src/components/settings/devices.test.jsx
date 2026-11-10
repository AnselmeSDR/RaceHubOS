import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ConnectionStatus from './ConnectionStatus'
import CuStatusCard from './CuStatusCard'
import DeviceList from './DeviceList'

const { device, app } = vi.hoisted(() => ({ device: {}, app: {} }))
vi.mock('@/context/DeviceContext', () => ({ SIMULATOR_ADDRESS: 'SIMULATOR', useDevice: () => device }))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))

const json = (body) => ({ ok: true, json: async () => body })
const track = { id: 'dev1', name: 'Carrera AppConnect', address: 'AA:BB', type: 'ble' }
const simulator = { id: 'sim', name: 'Simulator', address: 'SIMULATOR', type: 'simulator' }
let fetchMock

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  Object.assign(device, {
    connected: false,
    deviceAddress: null,
    devices: [track, simulator],
    scanResults: [],
    cuStatus: null,
    scanning: false,
    connecting: false,
    scan: vi.fn(async () => [track]),
    connect: vi.fn(async () => ({ success: true })),
    disconnect: vi.fn(),
    removeDevice: vi.fn(async () => ({ success: true })),
  })
  Object.assign(app, { isAdmin: false })
  fetchMock = vi.fn(async () => json({ success: true, data: null }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('ConnectionStatus', () => {
  test('no device', () => {
    render(<ConnectionStatus />)
    expect(screen.getByText('No device connected')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test.each([
    ['AA:BB', 'Connected: AA:BB'],
    ['SIMULATOR', 'Connected: Simulator'],
  ])('connected to %s, with the way to disconnect', async (address, text) => {
    Object.assign(device, { connected: true, deviceAddress: address })
    render(<ConnectionStatus />)
    expect(screen.getByText(text)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(device.disconnect).toHaveBeenCalled()
  })
})

describe('CuStatusCard', () => {
  test('nothing without a connected Control Unit', () => {
    device.cuStatus = { start: 0 }
    const { container } = render(<CuStatusCard />)
    expect(container).toBeEmptyDOMElement()
  })

  test('what the Control Unit reports, with a dash for what it does not', () => {
    Object.assign(device, { connected: true, cuStatus: { start: 2, mode: 3, fuel: [15, 12] } })
    render(<CuStatusCard />)
    const card = screen.getByTestId('settings-cu-status')
    expect(card).toHaveTextContent('Start2')
    expect(card).toHaveTextContent('Mode3')
    expect(card).toHaveTextContent('Display-')
    expect(card).toHaveTextContent('Fuel15, 12')
  })

  test('no fuel reading', () => {
    Object.assign(device, { connected: true, cuStatus: { start: 0 } })
    render(<CuStatusCard />)
    expect(screen.getByTestId('settings-cu-status')).toHaveTextContent('Fuel-')
  })
})

describe('DeviceList', () => {
  const names = () =>
    screen
      .getAllByTestId('settings-device')
      .map((row) => within(row).getByText(/./, { selector: 'p.font-medium' }).textContent)

  test('known devices, the simulator only in admin mode', () => {
    const { rerender } = render(<DeviceList onLog={vi.fn()} />)
    expect(names()).toEqual(['Carrera AppConnect'])
    app.isAdmin = true
    rerender(<DeviceList onLog={vi.fn()} />)
    expect(names()).toEqual(['Carrera AppConnect', 'Simulator'])
  })

  test('scanned devices come after, marked new, without duplicates', () => {
    device.devices = [track]
    device.scanResults = [track, { name: 'Other CU', address: 'CC:DD', type: 'ble' }, simulator]
    render(<DeviceList onLog={vi.fn()} />)
    expect(names()).toEqual(['Carrera AppConnect', 'Other CU(new)'])
  })

  test('a scanned simulator shows in admin mode', () => {
    app.isAdmin = true
    device.devices = []
    device.scanResults = [simulator]
    render(<DeviceList onLog={vi.fn()} />)
    expect(names()).toEqual(['Simulator(new)'])
  })

  test('connecting logs the result', async () => {
    const user = userEvent.setup()
    const onLog = vi.fn()
    app.isAdmin = true
    render(<DeviceList onLog={onLog} />)
    const [trackConnect, simulatorConnect] = screen.getAllByRole('button', { name: 'Connect' })

    await user.click(trackConnect)
    expect(device.connect).toHaveBeenCalledWith('AA:BB')
    expect(onLog).toHaveBeenLastCalledWith('Connected to AA:BB')
    await user.click(simulatorConnect)
    expect(onLog).toHaveBeenLastCalledWith('Connected to Simulator')

    device.connect.mockResolvedValue({ success: false, error: 'timeout' })
    await user.click(trackConnect)
    expect(onLog).toHaveBeenLastCalledWith('Error: timeout')
  })

  test('the connected device is ticked; connecting another needs a disconnect first', () => {
    Object.assign(device, {
      connected: true,
      deviceAddress: 'AA:BB',
      devices: [track, { ...track, id: 'dev2', address: 'EE' }],
    })
    render(<DeviceList onLog={vi.fn()} />)
    const [connectedRow, otherRow] = screen.getAllByTestId('settings-device')
    expect(within(connectedRow).queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    expect(within(otherRow).getByRole('button', { name: 'Connect' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Search for a new track' })).toBeDisabled()
  })

  test('while connecting or scanning, the buttons say so', () => {
    Object.assign(device, { connecting: true, scanning: true })
    render(<DeviceList onLog={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Connecting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Scanning...' })).toBeDisabled()
  })

  test('scanning logs how many devices answered', async () => {
    const onLog = vi.fn()
    render(<DeviceList onLog={onLog} />)
    await userEvent.click(screen.getByRole('button', { name: 'Search for a new track' }))
    expect(device.scan).toHaveBeenCalledWith(15000)
    expect(onLog.mock.calls).toEqual([['Scanning...'], ['1 device(s) found']])
  })

  test('forgetting a device logs the result; the simulator cannot be forgotten', async () => {
    const user = userEvent.setup()
    const onLog = vi.fn()
    app.isAdmin = true
    render(<DeviceList onLog={onLog} />)
    const [trackRow, simulatorRow] = screen.getAllByTestId('settings-device')
    expect(within(simulatorRow).queryByTitle('Delete')).not.toBeInTheDocument()

    await user.click(within(trackRow).getByTitle('Delete'))
    expect(device.removeDevice).toHaveBeenCalledWith('dev1')
    expect(onLog).toHaveBeenLastCalledWith('Device Carrera AppConnect deleted')

    device.removeDevice.mockResolvedValue({ success: false, error: 'busy' })
    await user.click(within(trackRow).getByTitle('Delete'))
    expect(onLog).toHaveBeenLastCalledWith('Error: busy')
  })

  test('auto-connect is read from the preferences and saved when switched', async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: true }))
    render(<DeviceList onLog={vi.fn()} />)
    const toggle = screen.getByRole('switch', { name: 'Auto' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByText('Auto')).toBeInTheDocument()

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Manual')).toBeInTheDocument()
    const [url, options] = fetchMock.mock.calls.at(-1)
    expect(url).toMatch(/\/api\/preferences\/autoConnect$/)
    expect(options).toMatchObject({ method: 'PUT', body: JSON.stringify({ value: false }) })
  })

  test('auto-connect stays off when the preference is unset or unreadable', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    render(<DeviceList onLog={vi.fn()} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByRole('switch', { name: 'Auto' })).toHaveAttribute('aria-checked', 'false')
    // Saving while the server is down does not break the switch
    await userEvent.click(screen.getByRole('switch', { name: 'Auto' }))
    expect(screen.getByRole('switch', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
  })
})
