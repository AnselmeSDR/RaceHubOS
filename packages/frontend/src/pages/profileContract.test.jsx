import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import CarProfile from './CarProfile'
import DriverProfile from './DriverProfile'
import TrackProfile from './TrackProfile'

// Add-ons wrap these modules (docs/ADDONS.md § split it in the core): what they receive is a contract
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
vi.mock('@/components/car/CarIdentity', () => spy('CarIdentity'))
vi.mock('@/components/car/CarProfileActions', () => spy('CarProfileActions'))
vi.mock('@/components/car/CarRecentSessions', () => spy('CarRecentSessions'))
vi.mock('@/components/track/TrackIdentity', () => spy('TrackIdentity'))
vi.mock('@/components/track/TrackProfileActions', () => spy('TrackProfileActions'))
vi.mock('@/components/track/TrackRecord', () => spy('TrackRecord'))
vi.mock('@/components/track/TrackRecentSessions', () => spy('TrackRecentSessions'))
vi.mock('@/components/driver/DriverIdentity', () => spy('DriverIdentity'))
vi.mock('@/components/driver/DriverProfileActions', () => spy('DriverProfileActions'))
vi.mock('@/components/driver/DriverRecentSessions', () => spy('DriverRecentSessions'))

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => vi.unstubAllGlobals())

test.each([
  ['car', CarProfile, '/cars', ['CarIdentity', 'CarProfileActions', 'CarRecentSessions']],
  ['track', TrackProfile, '/tracks', ['TrackIdentity', 'TrackProfileActions', 'TrackRecord', 'TrackRecentSessions']],
  ['driver', DriverProfile, '/drivers', ['DriverIdentity', 'DriverProfileActions', 'DriverRecentSessions']],
])('the %s profile hands the whole record to each of its pieces', async (name, Page, list, pieces) => {
  const record = { id: 'x1', name: 'Anything', brand: 'B', model: 'M', sessions: [], records: [] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: record }) }))
  )
  render(
    <MemoryRouter initialEntries={[`${list}/x1`]}>
      <Routes>
        <Route path={`${list}/:id`} element={<Page />} />
      </Routes>
    </MemoryRouter>
  )
  await screen.findByTestId(pieces[0])
  for (const piece of pieces) expect(received[piece][name]).toEqual(record)

  const actions = received[pieces[1]]
  expect(actions).toEqual(
    expect.objectContaining({
      resetting: false,
      onEdit: expect.any(Function),
      onResetStats: expect.any(Function),
      onDelete: expect.any(Function),
    })
  )
})
