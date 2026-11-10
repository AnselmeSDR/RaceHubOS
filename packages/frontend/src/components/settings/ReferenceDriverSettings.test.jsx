import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ReferenceDriverSettings from './ReferenceDriverSettings'

const json = (body) => ({ ok: true, json: async () => body })
const ayrton = { id: 'd1', name: 'Ayrton' }
const stig = { id: 'stig', name: 'The STIG' }
let api
let fetchMock

/** A fake server: `api` holds what each route answers, overridable per test. */
beforeEach(() => {
  api = {
    drivers: async () => json({ success: true, data: [ayrton] }),
    reference: async () => json({ success: true, data: null }),
    select: async (body) => json({ success: true, data: body.driverId ? ayrton : null }),
    stig: async () => json({ success: true, data: stig }),
    migrate: async () => json({ success: true, data: { laps: 12, driver: ayrton } }),
  }
  fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/api/drivers')) return api.drivers()
    if (url.endsWith('/api/drivers/reference') && options.method === 'PUT') return api.select(JSON.parse(options.body))
    if (url.endsWith('/api/drivers/reference')) return api.reference()
    if (url.endsWith('/reference/stig')) return api.stig()
    if (url.endsWith('/reference/migrate-balancing')) return api.migrate()
    throw new Error(`unexpected ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})
beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => vi.unstubAllGlobals())

const picker = () => screen.getByRole('combobox', { name: 'Choose a driver' })
const migrateButton = () => screen.getByRole('button', { name: 'Claim' })

test('no reference driver yet: a warning, and nothing to claim', async () => {
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(screen.getByText('Without a reference driver, balancing laps are credited to nobody.')).toBeInTheDocument()
  expect(migrateButton()).toBeDisabled()
})

test('the current reference driver is shown', async () => {
  api.reference = async () => json({ success: true, data: ayrton })
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(picker()).toHaveTextContent('Ayrton'))
  expect(screen.queryByText(/credited to nobody/)).not.toBeInTheDocument()
  expect(migrateButton()).toBeEnabled()
})

test('lists that fail to load leave the section usable', async () => {
  api.drivers = async () => json({ success: false })
  api.reference = async () => Promise.reject(new Error('down'))
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(picker()).toBeEnabled()
})

test('a driver list without data', async () => {
  api.drivers = async () => json({ success: true })
  api.reference = async () => json({ success: false })
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  await userEvent.click(picker())
  expect(screen.queryAllByRole('option')).toHaveLength(0)
})

test('the list fails entirely', async () => {
  api.drivers = async () => Promise.reject(new Error('down'))
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(screen.getByText(/credited to nobody/)).toBeInTheDocument()
})

test('choosing a driver makes them the reference', async () => {
  const user = userEvent.setup()
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

  await user.click(picker())
  await user.click(screen.getByRole('option', { name: 'Ayrton' }))
  await waitFor(() => expect(picker()).toHaveTextContent('Ayrton'))
  const [, options] = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT')
  expect(JSON.parse(options.body)).toEqual({ driverId: 'd1' })
  expect(migrateButton()).toBeEnabled()
})

test('a refused choice says why and keeps the previous one', async () => {
  const user = userEvent.setup()
  api.select = async () => json({ success: false, error: 'Driver deleted' })
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

  await user.click(picker())
  await user.click(screen.getByRole('option', { name: 'Ayrton' }))
  expect(await screen.findByText('Error: Driver deleted')).toBeInTheDocument()
  expect(screen.getByText(/credited to nobody/)).toBeInTheDocument()
})

test('creating the STIG makes them the reference and reloads the list', async () => {
  const user = userEvent.setup()
  let resolveStig
  api.stig = () => new Promise((resolve) => (resolveStig = resolve))
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

  await user.click(screen.getByRole('button', { name: 'Create The STIG' }))
  expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()
  expect(picker()).toBeDisabled()
  resolveStig(json({ success: true, data: stig }))

  expect(await screen.findByText('The STIG was created and set as reference driver')).toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
  expect(screen.getByRole('button', { name: 'Create The STIG' })).toBeEnabled()
})

test('creating the STIG may fail', async () => {
  api.stig = async () => Promise.reject(new Error('disk full'))
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  await userEvent.click(screen.getByRole('button', { name: 'Create The STIG' }))
  expect(await screen.findByText('Error: disk full')).toBeInTheDocument()
})

test('a STIG creation answering nothing changes nothing', async () => {
  api.stig = async () => json({ success: true, data: null })
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  await userEvent.click(screen.getByRole('button', { name: 'Create The STIG' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  expect(screen.queryByText(/was created/)).not.toBeInTheDocument()
})

test('claiming the past balancing laps says how many moved', async () => {
  const user = userEvent.setup()
  api.reference = async () => json({ success: true, data: ayrton })
  let resolveMigrate
  api.migrate = () => new Promise((resolve) => (resolveMigrate = resolve))
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(migrateButton()).toBeEnabled())

  await user.click(migrateButton())
  expect(screen.getByRole('button', { name: 'Claiming...' })).toBeDisabled()
  resolveMigrate(json({ success: true, data: { laps: 12, driver: ayrton } }))
  expect(await screen.findByText('12 laps reassigned to Ayrton')).toBeInTheDocument()
})

test('a failed claim says why', async () => {
  api.reference = async () => json({ success: true, data: ayrton })
  api.migrate = async () => json({ success: false, error: 'No balancing session' })
  render(<ReferenceDriverSettings />)
  await waitFor(() => expect(migrateButton()).toBeEnabled())
  await userEvent.click(migrateButton())
  expect(await screen.findByText('Error: No balancing session')).toBeInTheDocument()
})
