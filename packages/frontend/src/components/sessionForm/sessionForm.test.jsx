import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FuelMode, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { field, routeFetch, withStatus } from '@/test/helpers'
import SessionForm from '../SessionForm'
import SessionDriverRow from './SessionDriverRow'
import {
  availableSlotsOf,
  completeRows,
  initialFormData,
  loadSessionFormData,
  nextController,
  saveSession,
} from './sessionFormData'
import SessionGeneralFields from './SessionGeneralFields'
import SessionLineUp from './SessionLineUp'

const tracks = [{ id: 't1', name: 'Monza' }]
const championships = [{ id: 'c1', name: 'Winter Cup' }]
const drivers = [
  { id: 'd1', name: 'Ana' },
  { id: 'd2', name: 'Ben' },
]
const cars = [{ id: 'k1', brand: 'Ferrari', model: '499P' }]
const row = (overrides = {}) => ({
  driverId: '',
  carId: '',
  controller: '',
  gridPos: null,
  position: null,
  ...overrides,
})

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('form data', () => {
  test('a new practice session, or the values of the one edited', () => {
    expect(initialFormData()).toEqual({
      name: '',
      type: SessionType.PRACTICE,
      trackId: '',
      championshipId: '',
      duration: null,
      maxLaps: null,
      fuelMode: FuelMode.OFF,
      drivers: [],
    })
    expect(
      initialFormData({
        name: 'GP',
        type: SessionType.RACE,
        trackId: 't1',
        championshipId: 'c1',
        duration: 20,
        maxLaps: 30,
        fuelMode: FuelMode.ON,
        drivers: [
          { driverId: 'd1', carId: 'k1', controller: '2', gridPos: 1, position: 3, extra: 'x' },
          { driverId: 'd2' },
        ],
      })
    ).toEqual({
      name: 'GP',
      type: SessionType.RACE,
      trackId: 't1',
      championshipId: 'c1',
      duration: 20,
      maxLaps: 30,
      fuelMode: FuelMode.ON,
      drivers: [
        { driverId: 'd1', carId: 'k1', controller: '2', gridPos: 1, position: 3 },
        { driverId: 'd2', carId: undefined, controller: '', gridPos: null, position: null },
      ],
    })
  })

  test("the simulator's cars, the Control Unit's, or six controllers", () => {
    expect(availableSlotsOf({ isMockDevice: true, cars: [1, 2, 3, 4] })).toBe(4)
    expect(availableSlotsOf({ isMockDevice: true })).toBe(6)
    expect(availableSlotsOf({ cuNumCars: 8 })).toBe(8)
    expect(availableSlotsOf({})).toBe(6)
  })

  test('the first free controller, none when all are taken', () => {
    expect(nextController([], 4)).toBe('1')
    expect(nextController([row({ controller: '1' }), row({ controller: '3' })], 4)).toBe('2')
    expect(nextController([row({ controller: '1' }), row({ controller: '2' })], 2)).toBe('')
  })

  test('only complete rows', () => {
    const full = row({ driverId: 'd1', carId: 'k1', controller: '1' })
    expect(completeRows([full, row({ driverId: 'd1', carId: 'k1' }), row()])).toEqual([full])
  })

  test('the choices and the controllers, read together', async () => {
    routeFetch({
      '/api/tracks': { data: tracks },
      '/api/championships': {},
      '/api/drivers': { data: drivers },
      '/api/cars': { data: cars },
      '/api/simulator': { cuNumCars: 4 },
    })
    expect(await loadSessionFormData()).toEqual({ tracks, championships: [], drivers, cars, availableSlots: 4 })
  })

  test('saving creates, or updates the session edited', async () => {
    const mock = routeFetch({ '/api/sessions': { success: true, data: { id: 's9' } } })
    expect(await saveSession(null, { name: 'x' }, 'fallback')).toEqual({ id: 's9' })
    expect(mock).toHaveBeenLastCalledWith('/api/sessions', expect.objectContaining({ method: 'POST' }))
    await saveSession({ id: 's1' }, { name: 'x' }, 'fallback')
    expect(mock).toHaveBeenLastCalledWith('/api/sessions/s1', expect.objectContaining({ method: 'PUT' }))
  })

  test("a refused save throws the server's error, or the fallback", async () => {
    routeFetch({ 'POST /api/sessions': withStatus(409, { error: 'Track busy' }), 'PUT /api/sessions': 400 })
    await expect(saveSession(null, {}, 'fallback')).rejects.toThrow('Track busy')
    await expect(saveSession({ id: 's1' }, {}, 'fallback')).rejects.toThrow('fallback')
  })
})

describe('SessionGeneralFields', () => {
  test('each field sets its value', async () => {
    const setField = vi.fn()
    render(
      <SessionGeneralFields
        formData={initialFormData()}
        setField={setField}
        tracks={tracks}
        championships={championships}
      />
    )
    await userEvent.type(field('Name'), 'G')
    expect(setField).toHaveBeenCalledWith('name', 'G')
    await userEvent.selectOptions(field('Type'), SessionType.RACE)
    expect(setField).toHaveBeenCalledWith('type', SessionType.RACE)
    await userEvent.selectOptions(field('Track'), 't1')
    expect(setField).toHaveBeenCalledWith('trackId', 't1')
    await userEvent.selectOptions(field('Championship (optional)'), 'c1')
    expect(setField).toHaveBeenCalledWith('championshipId', 'c1')
    await userEvent.selectOptions(field('Fuel'), FuelMode.ON)
    expect(setField).toHaveBeenCalledWith('fuelMode', FuelMode.ON)
    await userEvent.type(field('Duration (minutes)'), '5')
    expect(setField).toHaveBeenCalledWith('duration', 5)
    await userEvent.type(field('Max laps'), '9')
    expect(setField).toHaveBeenCalledWith('maxLaps', 9)
  })

  test('emptied numbers are no limit', async () => {
    const setField = vi.fn()
    render(
      <SessionGeneralFields
        formData={{ ...initialFormData(), duration: 5, maxLaps: 9 }}
        setField={setField}
        tracks={[]}
        championships={[]}
      />
    )
    await userEvent.clear(field('Duration (minutes)'))
    expect(setField).toHaveBeenCalledWith('duration', null)
    await userEvent.clear(field('Max laps'))
    expect(setField).toHaveBeenCalledWith('maxLaps', null)
  })
})

describe('SessionDriverRow', () => {
  test("another row's controllers are taken; each choice changes the row", async () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    render(
      <SessionDriverRow
        row={row({ gridPos: 2 })}
        drivers={drivers}
        cars={cars}
        availableSlots={3}
        usedControllers={['2']}
        onChange={onChange}
        onRemove={onRemove}
      />
    )
    const [driver, car, controller] = screen.getAllByRole('combobox')
    expect(within(controller).getByRole('option', { name: '2 (used)' })).toBeDisabled()
    expect(within(controller).getByRole('option', { name: '3' })).toBeEnabled()
    await userEvent.selectOptions(driver, 'd2')
    expect(onChange).toHaveBeenCalledWith('driverId', 'd2')
    await userEvent.selectOptions(car, 'k1')
    expect(onChange).toHaveBeenCalledWith('carId', 'k1')
    await userEvent.selectOptions(controller, '3')
    expect(onChange).toHaveBeenCalledWith('controller', '3')
    await userEvent.type(screen.getByPlaceholderText('Grid'), '4')
    expect(onChange).toHaveBeenCalledWith('gridPos', 24)
    await userEvent.clear(screen.getByPlaceholderText('Grid'))
    expect(onChange).toHaveBeenCalledWith('gridPos', null)
    await userEvent.click(screen.getByRole('button'))
    expect(onRemove).toHaveBeenCalledOnce()
  })
})

describe('SessionLineUp', () => {
  const lineUp = (rows, onRowsChange = vi.fn(), slots = 3) => {
    render(
      <SessionLineUp rows={rows} onRowsChange={onRowsChange} drivers={drivers} cars={cars} availableSlots={slots} />
    )
    return onRowsChange
  }

  test('empty, adding takes the first free controller', async () => {
    const onRowsChange = lineUp([])
    expect(screen.getByText('No drivers added')).toBeInTheDocument()
    expect(screen.getByText('0/3 slots')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onRowsChange).toHaveBeenCalledWith([row({ controller: '1' })])
  })

  test('changing and removing rows', async () => {
    const rows = [row({ controller: '1' }), row({ controller: '2' })]
    const onRowsChange = lineUp(rows)
    const [first] = screen.getAllByTestId('session-driver-row')
    await userEvent.selectOptions(within(first).getAllByRole('combobox')[0], 'd1')
    expect(onRowsChange).toHaveBeenLastCalledWith([row({ controller: '1', driverId: 'd1' }), rows[1]])
    // The other row's controller is taken
    expect(within(first).getByRole('option', { name: '2 (used)' })).toBeDisabled()
    await userEvent.click(within(first).getAllByRole('button').at(-1))
    expect(onRowsChange).toHaveBeenLastCalledWith([rows[1]])
  })

  test('no more rows than controllers', () => {
    lineUp([row({ controller: '1' }), row({ controller: '2' })], vi.fn(), 2)
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByText('2/2 slots')).toBeInTheDocument()
  })
})

describe('SessionForm', () => {
  function api(overrides = {}) {
    return routeFetch({
      '/api/tracks': { data: tracks },
      '/api/championships': { data: championships },
      '/api/drivers': { data: drivers },
      '/api/cars': { data: cars },
      '/api/simulator': { isMockDevice: true, cars: [1, 2] },
      ...overrides,
    })
  }

  async function opened(props = {}) {
    const handlers = { onClose: vi.fn(), onSaved: vi.fn() }
    render(<SessionForm {...handlers} {...props} />)
    await screen.findByText('General information')
    return handlers
  }

  const submit = () => userEvent.click(screen.getByRole('button', { name: /Create session|Update/ }))

  test('loading, then the choices and the controllers available', async () => {
    api()
    render(<SessionForm onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    await screen.findByText('New session')
    expect(screen.getByRole('option', { name: 'Monza' })).toBeInTheDocument()
    expect(screen.getByText('0/2 slots')).toBeInTheDocument()
  })

  test('an error when the choices cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api({ '/api/simulator': new Error('offline') })
    await opened()
    expect(screen.getByText('Error loading data')).toBeInTheDocument()
    expect(screen.getByText('0/6 slots')).toBeInTheDocument()
  })

  test('a track is required', async () => {
    const mock = api()
    await opened()
    // The browser refuses the submit first; the form checks again
    expect(field('Track')).toBeRequired()
    fireEvent.submit(screen.getByRole('button', { name: 'Create session' }).form)
    expect(screen.getByText('Track is required')).toBeInTheDocument()
    expect(mock.mock.calls.some(([, init]) => init?.method)).toBe(false)
  })

  test('a line-up of incomplete rows only is refused', async () => {
    api()
    await opened()
    await userEvent.selectOptions(field('Track'), 't1')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await submit()
    expect(screen.getByText(/At least one complete driver is required/)).toBeInTheDocument()
  })

  test('creates the session with its complete rows, then closes', async () => {
    const mock = api({ 'POST /api/sessions': { success: true, data: { id: 's9' } } })
    const { onSaved, onClose } = await opened()
    await userEvent.type(field('Name'), 'GP')
    await userEvent.selectOptions(field('Track'), 't1')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    const [first] = screen.getAllByTestId('session-driver-row')
    const [driver, car] = within(first).getAllByRole('combobox')
    await userEvent.selectOptions(driver, 'd1')
    await userEvent.selectOptions(car, 'k1')
    await submit()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 's9' }))
    expect(onClose).toHaveBeenCalled()
    const body = JSON.parse(mock.mock.calls.find(([, init]) => init?.method === 'POST')[1].body)
    expect(body).toMatchObject({ name: 'GP', trackId: 't1', fuelMode: FuelMode.OFF })
    expect(body.drivers).toEqual([row({ driverId: 'd1', carId: 'k1', controller: '1' })])
  })

  test("editing updates the session; the server's refusal is shown", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api({ 'PUT /api/sessions/s1': withStatus(409, { error: 'Session running' }) })
    const { onSaved } = await opened({ session: { id: 's1', name: 'GP', trackId: 't1' } })
    expect(screen.getByText('Edit session')).toBeInTheDocument()
    expect(field('Name')).toHaveValue('GP')
    await submit()
    expect(await screen.findByText('Session running')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('cancel and the cross close without saving', async () => {
    api()
    const { onClose, onSaved } = await opened()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSaved).not.toHaveBeenCalled()
  })
})
