import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '@/i18n'
import { PageHeaderProvider, useSetPageHeader } from '@/context/PageHeaderContext'
import { routeFetch } from '@/test/helpers'
import Layout from '../Layout'
import { cuStateColor, cuStateLabel } from './cuState'
import PageHeader from './PageHeader'
import StatusFooter from './StatusFooter'
import { useBackendHealth } from './useBackendHealth'

const device = vi.hoisted(() => ({ current: {} }))
vi.mock('@/context/DeviceContext', () => ({ SIMULATOR_ADDRESS: 'SIMULATOR', useDevice: () => device.current }))
vi.mock('@/context/AppContext', () => ({ useApp: () => ({ sidebarOpen: true, setSidebarOpen: () => {} }) }))
vi.mock('@/components/AppSidebar', () => ({
  default: ({ backendConnected, backendVersion, onStatusClick }) => (
    <button onClick={onStatusClick}>{`${backendConnected} ${backendVersion}`}</button>
  ),
}))
vi.mock('@/components/BackendStatusPopup', () => ({
  default: ({ isOpen, onClose }) => isOpen && <button onClick={onClose}>status sheet</button>,
}))

const t = i18n.getFixedT('en', 'layout')

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('the start light state in words and its color', () => {
  expect([0, 1, 5, 6, 7, 8, 9, undefined].map((start) => cuStateLabel(t, start))).toEqual([
    'Racing',
    'Lights 1/5',
    'Lights 5/5',
    'False Start',
    'Go!',
    'Stopped',
    'Stopped',
    'Unknown',
  ])
  expect(cuStateColor(0)).toBe('text-green-500')
  expect(cuStateColor(7)).toBe('text-yellow-500')
  expect(cuStateColor(8)).toBe('text-muted-foreground')
  expect(cuStateColor(undefined)).toBe('text-muted-foreground')
})

describe('StatusFooter', () => {
  test('no device: red, unknown state, no mode', () => {
    device.current = { connected: false }
    render(<StatusFooter />)
    expect(screen.getByTestId('status-footer')).toHaveTextContent('NO CU|Unknown|Mode -')
    expect(screen.getByText('NO CU')).toHaveClass('text-red-500')
  })

  test('the Control Unit racing, its last lap', () => {
    device.current = {
      connected: true,
      deviceAddress: 'AA:BB',
      cuStatus: { start: 0, mode: 2 },
      lastTimer: { controller: 1, isFinishLine: true, lapTime: 8123 },
    }
    render(<StatusFooter />)
    expect(screen.getByTestId('status-footer')).toHaveTextContent('CU|Racing|Mode 2|C28.123s')
    expect(screen.getByText('CU')).toHaveClass('text-green-500')
  })

  test('the simulator, the start of a lap and a sector', () => {
    device.current = {
      connected: true,
      deviceAddress: 'SIMULATOR',
      cuStatus: { start: 3, mode: 0 },
      lastTimer: { controller: 0, isFinishLine: true, lapTime: 0 },
    }
    const { rerender } = render(<StatusFooter />)
    expect(screen.getByText('SIMULATOR')).toHaveClass('text-purple-400')
    expect(screen.getByTestId('status-footer')).toHaveTextContent('Lights 3/5|Mode 0|C1start')

    device.current = { ...device.current, lastTimer: { controller: 0, isFinishLine: false, sector: 2 } }
    rerender(<StatusFooter />)
    expect(screen.getByText('S2')).toBeInTheDocument()
  })
})

describe('PageHeader', () => {
  function Page(props) {
    useSetPageHeader(props)
    return null
  }
  const renderAt = (path, page) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <PageHeaderProvider>
          <PageHeader />
          {page}
        </PageHeaderProvider>
      </MemoryRouter>
    )

  test("the menu entry's name until the page sets a header, the app's name off the menu", () => {
    renderAt('/history/42')
    expect(screen.getByRole('heading')).toHaveTextContent('History')
    cleanup()
    renderAt('/nowhere')
    expect(screen.getByRole('heading')).toHaveTextContent('RaceHubOS')
  })

  test("the page's title, count, view toggle and add button", async () => {
    const onAdd = vi.fn()
    const onViewModeChange = vi.fn()
    const page = (
      <Page
        title="Drivers"
        icon={<svg data-testid="icon" />}
        color="blue"
        totalCount={3}
        hasGrid
        viewMode="grid"
        onViewModeChange={onViewModeChange}
        onAdd={onAdd}
        addLabel="New driver"
      />
    )
    renderAt('/drivers', page)
    expect(screen.getByRole('heading')).toHaveTextContent('Drivers')
    expect(screen.getByText('3 results')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('view-list'))
    expect(onViewModeChange).toHaveBeenCalledWith('list')
    await userEvent.click(screen.getByTestId('page-add'))
    expect(onAdd).toHaveBeenCalled()
    expect(screen.getByTestId('page-add')).toHaveTextContent('New driver')
  })

  test('dots while loading, nothing without a count, no toggle nor button unless asked', () => {
    const { rerender } = renderAt('/drivers', <Page title="Drivers" loading />)
    expect(screen.getByText('...')).toBeInTheDocument()
    rerender(
      <MemoryRouter initialEntries={['/drivers']}>
        <PageHeaderProvider>
          <PageHeader />
          <Page title="Drivers" />
        </PageHeaderProvider>
      </MemoryRouter>
    )
    expect(screen.queryByText('...')).not.toBeInTheDocument()
    expect(screen.queryByTestId('view-grid')).not.toBeInTheDocument()
    expect(screen.queryByTestId('page-add')).not.toBeInTheDocument()
  })
})

describe('useBackendHealth', () => {
  test('connected with its version, polled every five seconds, the version kept when the server falls', async () => {
    vi.useFakeTimers()
    let reply = { status: 'ok', version: '1.25.8' }
    const fetch = routeFetch({ '/health': () => reply })
    const { result } = renderHook(() => useBackendHealth())
    expect(result.current).toEqual({ connected: true, version: '0.1.0' })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current).toEqual({ connected: true, version: '1.25.8' })

    reply = new Error('down')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current).toEqual({ connected: false, version: '1.25.8' })

    reply = { status: 'starting' }
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(result.current).toEqual({ connected: false, version: '0.1.0' })
  })
})

test('the frame: server health in the sidebar, the page, the footer, the status sheet on demand', async () => {
  routeFetch({ '/health': { status: 'ok', version: '1.25.8' } })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  device.current = { connected: false }
  render(
    <MemoryRouter initialEntries={['/stats']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/stats" element={<p>stats page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByTestId('page-content')).toHaveTextContent('stats page')
  expect(screen.getByRole('heading')).toHaveTextContent('Statistics')
  expect(screen.getByTestId('status-footer')).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'true 1.25.8' }))
  await userEvent.click(screen.getByRole('button', { name: 'status sheet' }))
  expect(screen.queryByRole('button', { name: 'status sheet' })).not.toBeInTheDocument()
})
