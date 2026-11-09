import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChampionshipMode, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { field, routeFetch } from '@/test/helpers'
import AutoChampionshipWizard from '../AutoChampionshipWizard'
import WizardConfigStep from './WizardConfigStep'
import WizardInfoStep from './WizardInfoStep'
import WizardParticipantsStep from './WizardParticipantsStep'
import WizardPreviewStep from './WizardPreviewStep'
import WizardSteps from './WizardSteps'
import {
  championshipBody,
  createAutoChampionship,
  DEFAULT_WIZARD_CONFIG,
  groupCount,
  isConfigValid,
  qualifGroups,
  raceGroups,
  withEmptyRow,
} from './wizardPlan'

const tracks = [{ id: 't1', name: 'Monza' }]
const drivers = ['Ana', 'Ben', 'Cid', 'Dan', 'Eva'].map((name, i) => ({ id: `d${i + 1}`, name }))
const entry = (driver) => ({ driverId: driver.id, driver })
const EMPTY = { driverId: null, driver: null }

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('plan', () => {
  test('number of groups, none without participants', () => {
    expect(groupCount(0, 4)).toBe(0)
    expect(groupCount(5, 4)).toBe(2)
    expect(groupCount(4, 4)).toBe(1)
  })

  test('an empty row always follows the last filled one', () => {
    expect(withEmptyRow([])).toEqual([EMPTY])
    expect(withEmptyRow([entry(drivers[0])])).toEqual([entry(drivers[0]), EMPTY])
    const lastEmpty = [entry(drivers[0]), EMPTY]
    expect(withEmptyRow(lastEmpty)).toBe(lastEmpty)
  })

  test('qualifying groups are dealt like cards', () => {
    const [a, b, c, d, e] = drivers.map(entry)
    expect(qualifGroups([a, b, c, d, e], 2)).toEqual([[a, d], [b, e], [c]])
    expect(qualifGroups([], 4)).toEqual([])
  })

  test('races share the ranking in balanced slices, the first ones take the extra drivers', () => {
    expect(raceGroups(7, 3)).toEqual([
      { start: 1, end: 3, count: 3 },
      { start: 4, end: 5, count: 2 },
      { start: 6, end: 7, count: 2 },
    ])
    expect(raceGroups(6, 6)).toEqual([{ start: 1, end: 6, count: 6 }])
    expect(raceGroups(0, 6)).toEqual([])
  })

  test('each kind of session needs a duration or a number of laps', () => {
    expect(isConfigValid(DEFAULT_WIZARD_CONFIG)).toBe(true)
    const noLimit = { useTime: false, duration: 5, useLaps: false, laps: 0 }
    expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, qualif: noLimit })).toBe(false)
    expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, race: noLimit })).toBe(false)
    expect(isConfigValid({ ...DEFAULT_WIZARD_CONFIG, race: { ...noLimit, useLaps: true } })).toBe(true)
  })

  test('the body sent: minutes in ms, unused or empty limits left out', () => {
    const body = championshipBody({
      name: '  Cup ',
      trackId: 't1',
      participants: [entry(drivers[0]), entry(drivers[1])],
      config: {
        driversPerQualif: 3,
        driversPerRace: 5,
        qualif: { useTime: false, duration: 5, useLaps: true, laps: 8 },
        race: { useTime: true, duration: 0, useLaps: true, laps: 0 },
      },
    })
    expect(body).toEqual({
      name: 'Cup',
      season: String(new Date().getFullYear()),
      trackId: 't1',
      mode: ChampionshipMode.AUTO,
      driversPerQualif: 3,
      driversPerRace: 5,
      qualifMaxDuration: null,
      qualifMaxLaps: 8,
      raceMaxDuration: null,
      raceMaxLaps: null,
      participants: [{ driverId: 'd1' }, { driverId: 'd2' }],
      sessionNames: expect.objectContaining({ [SessionType.RACE]: 'Race' }),
    })
    expect(
      championshipBody({ name: 'x', trackId: 't1', participants: [], config: DEFAULT_WIZARD_CONFIG })
    ).toMatchObject({ qualifMaxDuration: 300000, raceMaxDuration: 600000, qualifMaxLaps: null })
  })

  test("creating posts the body and returns the server's answer", async () => {
    const mock = routeFetch({ 'POST /api/championships': { success: true, data: { id: 'c1' } } })
    expect(await createAutoChampionship({ name: 'Cup' })).toEqual({ success: true, data: { id: 'c1' } })
    expect(mock).toHaveBeenCalledWith('/api/championships', expect.objectContaining({ body: '{"name":"Cup"}' }))
  })
})

describe('WizardSteps', () => {
  test('a step done can be reopened, the current and next ones cannot', async () => {
    const onStep = vi.fn()
    render(<WizardSteps step={2} onStep={onStep} />)
    const steps = within(screen.getByTestId('championship-wizard-steps')).getAllByRole('button')
    expect(steps.map((s) => s.textContent)).toEqual(['Info', 'Drivers', 'Configuration', 'Preview'])
    expect(steps[2]).toHaveAttribute('aria-current', 'step')
    expect(steps[3]).toBeDisabled()
    await userEvent.click(steps[2])
    expect(onStep).not.toHaveBeenCalled()
    await userEvent.click(steps[1])
    expect(onStep).toHaveBeenCalledWith(1)
  })
})

describe('WizardInfoStep', () => {
  test('name, track and the switch to the manual form', async () => {
    const props = { onNameChange: vi.fn(), onTrackChange: vi.fn(), onSwitchManual: vi.fn() }
    render(<WizardInfoStep name="" trackId="" tracks={tracks} {...props} />)
    await userEvent.type(field('Championship name'), 'C')
    expect(props.onNameChange).toHaveBeenCalledWith('C')
    await userEvent.selectOptions(field('Track'), 't1')
    expect(props.onTrackChange).toHaveBeenCalledWith('t1')
    await userEvent.click(screen.getByRole('switch', { name: 'Automatic mode' }))
    expect(props.onSwitchManual).toHaveBeenCalled()
  })

  test('the switch does nothing without a manual form', async () => {
    render(<WizardInfoStep name="" trackId="" tracks={[]} onNameChange={vi.fn()} onTrackChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toBeChecked()
  })
})

describe('WizardParticipantsStep', () => {
  const lineUp = (participants) => {
    const onChange = vi.fn()
    render(<WizardParticipantsStep participants={participants} drivers={drivers} onChange={onChange} />)
    return { onChange, selects: screen.getAllByRole('combobox') }
  }

  test('an empty row to add a driver not yet picked', async () => {
    const { onChange, selects } = lineUp([entry(drivers[0])])
    expect(screen.getByText('1 participant')).toBeInTheDocument()
    expect(selects).toHaveLength(2)
    expect(within(selects[1]).queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument()
    expect(within(selects[0]).getByRole('option', { name: 'Ana' })).toBeInTheDocument()
    await userEvent.selectOptions(selects[1], 'd2')
    expect(onChange).toHaveBeenCalledWith([entry(drivers[0]), entry(drivers[1])])
  })

  test('emptying a row, removing a driver', async () => {
    const { onChange, selects } = lineUp([entry(drivers[0]), entry(drivers[1])])
    await userEvent.selectOptions(selects[0], '')
    expect(onChange).toHaveBeenLastCalledWith([EMPTY, entry(drivers[1])])
    // Only filled rows can be removed
    const removes = screen.getAllByRole('button', { name: 'Delete' })
    expect(removes).toHaveLength(2)
    await userEvent.click(removes[0])
    expect(onChange).toHaveBeenLastCalledWith([entry(drivers[1])])
  })

  test('no extra row after an empty one', () => {
    const { selects } = lineUp([EMPTY])
    expect(selects).toHaveLength(1)
    expect(screen.getByText('0 participants')).toBeInTheDocument()
  })
})

describe('WizardConfigStep', () => {
  const configure = (config = DEFAULT_WIZARD_CONFIG, participantCount = 9) => {
    const onChange = vi.fn()
    render(<WizardConfigStep config={config} participantCount={participantCount} onChange={onChange} />)
    return onChange
  }

  test('groups and sessions counted from the participants', () => {
    configure()
    expect(screen.getByText('3 qualif groups')).toBeInTheDocument()
    expect(screen.getByText('2 races')).toBeInTheDocument()
    expect(screen.getByText('Total: 6 sessions (1 FP + 3 qualifs + 2 races)')).toBeInTheDocument()
  })

  test('two to six drivers per group', () => {
    const onChange = configure()
    fireEvent.change(field('Drivers per qualif'), { target: { value: '9' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WIZARD_CONFIG, driversPerQualif: 6 })
    fireEvent.change(field('Drivers per race'), { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WIZARD_CONFIG, driversPerRace: 2 })
    fireEvent.change(field('Drivers per race'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WIZARD_CONFIG, driversPerRace: 2 })
  })

  test('each card changes its own limits', async () => {
    const onChange = configure()
    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    const race = within(screen.getByTestId('championship-wizard-race-limits'))
    expect(qualif.getByText('Qualifications')).toBeInTheDocument()
    expect(race.queryByRole('spinbutton', { name: 'Laps' })).not.toBeInTheDocument()
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Duration' }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      qualif: { ...DEFAULT_WIZARD_CONFIG.qualif, useTime: false },
    })
    await userEvent.click(race.getByRole('checkbox', { name: 'Laps' }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      race: { ...DEFAULT_WIZARD_CONFIG.race, useLaps: true },
    })
    fireEvent.change(race.getByRole('spinbutton', { name: 'Duration' }), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      race: { ...DEFAULT_WIZARD_CONFIG.race, duration: 1 },
    })
  })

  test('laps, at least one', () => {
    const laps = { ...DEFAULT_WIZARD_CONFIG.qualif, useLaps: true, laps: 5 }
    const onChange = configure({ ...DEFAULT_WIZARD_CONFIG, qualif: laps })
    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    fireEvent.change(qualif.getByRole('spinbutton', { name: 'Laps' }), { target: { value: '12' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WIZARD_CONFIG, qualif: { ...laps, laps: 12 } })
    fireEvent.change(qualif.getByRole('spinbutton', { name: 'Laps' }), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_WIZARD_CONFIG, qualif: { ...laps, laps: 1 } })
  })
})

describe('WizardPreviewStep', () => {
  test('the qualifying groups by name, the races by ranking slice', () => {
    render(
      <WizardPreviewStep
        participants={drivers.map(entry)}
        config={{ ...DEFAULT_WIZARD_CONFIG, driversPerQualif: 3, driversPerRace: 4 }}
      />
    )
    const qualifs = screen.getAllByTestId('championship-wizard-qualif-group')
    expect(qualifs.map((g) => g.textContent)).toEqual(['Q1 (3 drivers)AnaCidEva', 'Q2 (2 drivers)BenDan'])
    const races = screen.getAllByTestId('championship-wizard-race-group')
    expect(races.map((g) => g.textContent)).toEqual([
      'R1 (3 drivers)Positions 1 to 3',
      'R2 (2 drivers)Positions 4 to 5',
    ])
  })
})

describe('AutoChampionshipWizard', () => {
  function api(created = { success: true, data: { id: 'c9' } }) {
    return routeFetch({ '/api/drivers': { success: true, data: drivers }, 'POST /api/championships': created })
  }

  function open(props = {}) {
    const handlers = { onFormChange: vi.fn(), onClose: vi.fn(), onCreated: vi.fn(), onSwitchManual: vi.fn() }
    render(<AutoChampionshipWizard tracks={tracks} {...handlers} {...props} />)
    return handlers
  }

  const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }))

  // Picks drivers[from..to[ in the empty row, one after the other
  async function pickDrivers(from, to) {
    for (let i = from; i < to; i++) {
      const selects = await screen.findAllByRole('combobox')
      await userEvent.selectOptions(selects.at(-1), drivers[i].id)
    }
  }

  async function toPreview(initial = { initialName: 'Cup', initialTrackId: 't1' }) {
    const handlers = open(initial)
    await next()
    await pickDrivers(0, 3)
    await next()
    await next()
    return handlers
  }

  test('each step must be complete to go on', async () => {
    api()
    const { onFormChange } = open()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.type(field('Championship name'), 'C')
    expect(onFormChange).toHaveBeenLastCalledWith({ name: 'C', trackId: '' })
    await userEvent.selectOptions(field('Track'), 't1')
    expect(onFormChange).toHaveBeenLastCalledWith({ name: 'C', trackId: 't1' })
    await next()

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await pickDrivers(0, 1)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await pickDrivers(1, 3)
    await next()

    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Duration' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Laps' }))
    await next()
    expect(screen.getByTestId('championship-wizard-preview')).toBeInTheDocument()
  })

  test('back, or a step done, returns to it with its values', async () => {
    api()
    await toPreview()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByTestId('championship-wizard-config')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Drivers' }))
    expect(screen.getByText('3 participants')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Info' }))
    expect(field('Championship name')).toHaveValue('Cup')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  test('creates the championship with its participants, then closes', async () => {
    const mock = api()
    const { onCreated, onClose } = await toPreview()
    expect(screen.getAllByTestId('championship-wizard-qualif-group')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Create championship' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'c9' }))
    expect(onClose).toHaveBeenCalled()
    const body = JSON.parse(mock.mock.calls.find(([, init]) => init?.method === 'POST')[1].body)
    expect(body).toMatchObject({
      name: 'Cup',
      trackId: 't1',
      mode: ChampionshipMode.AUTO,
      participants: [{ driverId: 'd1' }, { driverId: 'd2' }, { driverId: 'd3' }],
    })
  })

  test("the server's refusal, or a generic message, keeps the wizard open", async () => {
    api({ success: false, error: 'Track busy' })
    const { onClose } = await toPreview()
    await userEvent.click(screen.getByRole('button', { name: 'Create championship' }))
    expect(await screen.findByText('Track busy')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    cleanup()
    api({ success: false })
    await toPreview()
    await userEvent.click(screen.getByRole('button', { name: 'Create championship' }))
    expect(await screen.findByText('Error during creation')).toBeInTheDocument()
  })

  test('the server cannot be reached', async () => {
    api(new Error('offline'))
    await toPreview()
    await userEvent.click(screen.getByRole('button', { name: 'Create championship' }))
    expect(await screen.findByText('Server connection error')).toBeInTheDocument()
  })

  test('without drivers from the server, the list stays empty', async () => {
    routeFetch({ '/api/drivers': { success: false } })
    open({ initialName: 'Cup', initialTrackId: 't1' })
    await next()
    expect(screen.getAllByRole('option')).toHaveLength(1)
    cleanup()
    routeFetch({ '/api/drivers': new Error('offline') })
    open({ initialName: 'Cup', initialTrackId: 't1' })
    await next()
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  test('cancel closes; the switch goes to the manual form', async () => {
    api()
    const { onClose, onSwitchManual } = open()
    await userEvent.click(screen.getByRole('switch'))
    expect(onSwitchManual).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
