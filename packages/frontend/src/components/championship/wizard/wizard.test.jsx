import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChampionshipMode, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { field, routeFetch } from '@/test/helpers'
import ChampionshipWizard from '../ChampionshipWizard'
import WizardAutoConfig from './WizardAutoConfig'
import WizardConfigStep from './WizardConfigStep'
import WizardInfoStep from './WizardInfoStep'
import WizardManualConfig from './WizardManualConfig'
import WizardParticipantsStep from './WizardParticipantsStep'
import WizardSteps from './WizardSteps'
import { dealtPracticeGroups, dealtQualifGroups, DEFAULT_WIZARD_CONFIG } from './wizardPlan'

const { PRACTICE, QUALIF, RACE } = SessionType
const { DRAFT, FINISHED } = SessionStatus
const tracks = [{ id: 't1', name: 'Monza' }]
const GOLD = { id: 'gold', name: 'GOLD', color: '#F5D13C', scope: 'driver' }
const GT3 = { id: 'gt3', name: 'GT3', color: '#E11D48', scope: 'car' }
const GTE = { id: 'gte', name: 'GTE', color: '#7C3AED', scope: 'car' }
// The Ferrari is a GT3, the BMW in no category
const cars = [
  { id: 'ferrari', brand: 'Ferrari', model: '296', img: 'cars/ferrari.png', divisions: [GT3] },
  { id: 'bmw', brand: 'BMW', model: 'M4', img: null },
]
// Ana, in GOLD, prefers the Ferrari; a picture keeps a driver's initial out of the texts read
const drivers = ['Ana', 'Ben', 'Cid', 'Dan', 'Eva', 'Fay', 'Gus', 'Hal', 'Ivy'].map((name, i) => ({
  id: `d${i + 1}`,
  name,
  img: `drivers/${name}.png`,
  preferredCarId: i === 0 ? 'ferrari' : null,
  divisions: i === 0 ? [GOLD] : [],
}))
const divisionRoutes = {
  '/api/divisions?scope=driver': { success: true, data: [GOLD] },
  '/api/divisions?scope=car': { success: true, data: [GT3, GTE] },
}
const entry = (driver, carId = null) => ({
  driverId: driver.id,
  driver,
  carId,
  car: cars.find((c) => c.id === carId) ?? null,
})
const EMPTY = { driverId: null, driver: null, carId: null }
const lanes = () =>
  screen.getAllByTestId('championship-wizard-session').map((lane) => ({
    title: lane.firstChild.textContent,
    drivers: within(lane)
      .queryAllByTestId('wizard-driver')
      .map((d) => d.textContent),
  }))
const benchNames = () =>
  within(screen.getByTestId('championship-wizard-bench'))
    .queryAllByTestId('wizard-driver')
    .map((d) => d.textContent)

const ghost = (place) => within(place).queryByTestId('wizard-drop-ghost')?.textContent

// Drags `item` onto `target` as a browser would
function drag(item, target) {
  fireEvent.dragStart(item)
  fireEvent.dragOver(target)
  fireEvent.drop(target)
  fireEvent.dragEnd(item)
}

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('WizardSteps', () => {
  test('a step done can be reopened, the current and next ones cannot', async () => {
    const onStep = vi.fn()
    render(<WizardSteps step={1} onStep={onStep} />)
    const steps = within(screen.getByTestId('championship-wizard-steps')).getAllByRole('button')
    expect(steps.map((s) => s.textContent)).toEqual(['Info', 'Drivers', 'Configuration'])
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[2]).toBeDisabled()
    await userEvent.click(steps[1])
    expect(onStep).not.toHaveBeenCalled()
    await userEvent.click(steps[0])
    expect(onStep).toHaveBeenCalledWith(0)
  })
})

test('WizardInfoStep: name and track', async () => {
  const props = { onNameChange: vi.fn(), onTrackChange: vi.fn() }
  render(<WizardInfoStep name="" trackId="" tracks={tracks} {...props} />)
  await userEvent.type(field('Championship name'), 'C')
  expect(props.onNameChange).toHaveBeenCalledWith('C')
  await userEvent.selectOptions(field('Track'), 't1')
  expect(props.onTrackChange).toHaveBeenCalledWith('t1')
})

describe('WizardParticipantsStep', () => {
  const lineUp = (participants, divisionIds = []) => {
    routeFetch(divisionRoutes)
    const onChange = vi.fn()
    const onDivisionsChange = vi.fn()
    render(
      <WizardParticipantsStep
        participants={participants}
        drivers={drivers}
        cars={cars}
        divisionIds={divisionIds}
        onDivisionsChange={onDivisionsChange}
        onChange={onChange}
      />
    )
    return { onChange, onDivisionsChange, selects: screen.getAllByRole('combobox', { name: 'Driver' }) }
  }
  const options = (select) =>
    within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
  // The filters show their badges once the divisions are read
  const filtersRead = () => within(screen.getByTestId('division-filters')).findAllByTestId('division-badge')

  test('a driver not yet picked joins with the car preferred on their profile', async () => {
    const { onChange, selects } = lineUp([entry(drivers[1])])
    expect(screen.getByText('1 participant')).toBeInTheDocument()
    expect(selects).toHaveLength(2)
    expect(within(selects[1]).queryByRole('option', { name: 'Ben' })).not.toBeInTheDocument()
    await userEvent.selectOptions(selects[1], 'd1')
    expect(onChange).toHaveBeenCalledWith([entry(drivers[1]), entry(drivers[0], 'ferrari')])
    await userEvent.selectOptions(selects[1], 'd3')
    expect(onChange).toHaveBeenLastCalledWith([entry(drivers[1]), entry(drivers[2])])
  })

  test('the car can be changed for the championship; the profile one is marked', async () => {
    const { onChange } = lineUp([entry(drivers[0], 'ferrari'), entry(drivers[1])])
    expect(screen.getByText('★ Profile')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Ferrari 296' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: "Ana's car" }), 'bmw')
    expect(onChange).toHaveBeenLastCalledWith([entry(drivers[0], 'bmw'), entry(drivers[1])])
    await userEvent.selectOptions(screen.getByRole('combobox', { name: "Ben's car" }), '')
    expect(onChange).toHaveBeenLastCalledWith([entry(drivers[0], 'ferrari'), entry(drivers[1])])
    cleanup()
    lineUp([entry(drivers[0], 'bmw')])
    expect(screen.getByText('Changed')).toBeInTheDocument()
    expect(screen.queryByText('★ Profile')).not.toBeInTheDocument()
  })

  test('a car shared by several drivers: an icon naming the others, explained below', () => {
    lineUp([entry(drivers[0], 'ferrari'), entry(drivers[1], 'ferrari'), entry(drivers[2])])
    expect(screen.getAllByRole('img', { name: /^Car shared with/ }).map((icon) => icon.title)).toEqual([
      'Car shared with Ben',
      'Car shared with Ana',
    ])
    expect(screen.getByText(/^Car shared with another driver: allowed/)).toBeInTheDocument()
    // The car run shows the icon, not the names; the others name who runs them
    expect(screen.getByRole('combobox', { name: "Ana's car" })).toHaveDisplayValue('Ferrari 296')
    const cidCars = screen.getByRole('combobox', { name: "Cid's car" })
    expect(within(cidCars).getByRole('option', { name: 'Ferrari 296 · also: Ana, Ben' })).toBeInTheDocument()
  })

  test('emptying a row, removing a driver; no extra row after an empty one', async () => {
    const { onChange, selects } = lineUp([entry(drivers[0]), entry(drivers[1])])
    await userEvent.selectOptions(selects[0], '')
    expect(onChange).toHaveBeenLastCalledWith([{ ...EMPTY, car: null }, entry(drivers[1])])
    const removes = screen.getAllByRole('button', { name: 'Delete' })
    expect(removes).toHaveLength(2)
    await userEvent.click(removes[0])
    expect(onChange).toHaveBeenLastCalledWith([entry(drivers[1])])
    cleanup()
    expect(lineUp([EMPTY]).selects).toHaveLength(1)
    expect(screen.getByText('0 participants')).toBeInTheDocument()
  })

  test('the filters narrow the selectors; a participant outside them stays, flagged', async () => {
    const { selects } = lineUp([entry(drivers[1], 'bmw')], ['gold', 'gt3'])
    await filtersRead()
    expect(options(selects[1])).toEqual(['Driver...', 'Ana'])
    expect(screen.getByText('outside divisions')).toBeInTheDocument()
    expect(screen.getByText('outside categories')).toBeInTheDocument()
    // The car already run stays offered beside the GT3s
    expect(options(screen.getByRole('combobox', { name: "Ben's car" }))).toEqual(
      expect.arrayContaining(['Ferrari 296', 'BMW M4'])
    )
  })

  test('a preferred car outside the categories chosen is not given', async () => {
    const { onChange, selects } = lineUp([], ['gte'])
    await filtersRead()
    await userEvent.selectOptions(selects[0], 'd1')
    expect(onChange).toHaveBeenCalledWith([entry(drivers[0])])
  })

  test('choosing a division keeps the categories already chosen', async () => {
    const user = userEvent.setup()
    const { onDivisionsChange } = lineUp([], ['gt3'])
    await filtersRead()
    await user.click(screen.getByRole('button', { name: 'New division' }))
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /GOLD/ }))
    expect(onDivisionsChange).toHaveBeenCalledWith(['gold', 'gt3'])
  })
})

describe('WizardAutoConfig', () => {
  const nine = drivers.map((d) => entry(d))

  function configure({ config = DEFAULT_WIZARD_CONFIG, participants = nine, groups, practices } = {}) {
    const props = { onConfigChange: vi.fn(), onPracticeGroupsChange: vi.fn(), onQualifGroupsChange: vi.fn() }
    const qualifGroups = groups ?? dealtQualifGroups(participants, config.driversPerQualif)
    const practiceGroups = practices ?? dealtPracticeGroups(participants, config.practiceCount)
    render(
      <WizardAutoConfig
        config={config}
        participants={participants}
        practiceGroups={practiceGroups}
        qualifGroups={qualifGroups}
        {...props}
      />
    )
    return props
  }
  const groupTexts = () => screen.getAllByTestId('championship-wizard-qualif-group').map((g) => g.textContent)
  const practiceTexts = () => screen.getAllByTestId('championship-wizard-practice').map((p) => p.textContent)

  test('the practices and qualifying groups by name, the races by ranking slice', () => {
    configure()
    // One practice wanted: six controllers for nine drivers, three run none
    expect(practiceTexts()).toEqual(['FP16 / 6AnaBenCidDanEvaFay'])
    expect(screen.getByTestId('championship-wizard-no-practice')).toHaveTextContent(
      'No practice3GusHalIvyDrag them into a practice, or add them when it runs.'
    )
    expect(screen.getByRole('spinbutton', { name: /free practice in all/ })).toHaveValue(1)
    expect(screen.getByText('3 qualifs of 3 drivers')).toBeInTheDocument()
    expect(screen.getByText('2 races of 5 and 4 drivers')).toBeInTheDocument()
    expect(groupTexts()).toEqual([
      'Q13 / 4AnaDanGusFree place',
      'Q23 / 4BenEvaHalFree place',
      'Q33 / 4CidFayIvyFree place',
    ])
    const races = screen.getAllByTestId('championship-wizard-race-group')
    expect(races.map((r) => r.textContent)).toEqual(['R1Positions 1 to 5P1P2P3P4P5', 'R2Positions 6 to 9P6P7P8P9'])
  })

  test('zero to twenty free practices, two to six drivers per group', () => {
    const { onConfigChange } = configure({ config: { ...DEFAULT_WIZARD_CONFIG, practiceCount: 3 } })
    expect(screen.getAllByTestId('championship-wizard-practice')).toHaveLength(3)
    const three = { ...DEFAULT_WIZARD_CONFIG, practiceCount: 3 }
    fireEvent.change(screen.getByRole('spinbutton', { name: /free practices in all/ }), { target: { value: '30' } })
    expect(onConfigChange).toHaveBeenLastCalledWith({ ...three, practiceCount: 20 })
    fireEvent.change(screen.getByRole('spinbutton', { name: /free practices in all/ }), { target: { value: '' } })
    expect(onConfigChange).toHaveBeenLastCalledWith({ ...three, practiceCount: 0 })
    fireEvent.change(screen.getByRole('spinbutton', { name: /drivers per qualif/ }), { target: { value: '9' } })
    expect(onConfigChange).toHaveBeenLastCalledWith({ ...three, driversPerQualif: 6 })
    fireEvent.change(screen.getByRole('spinbutton', { name: /drivers per race/ }), { target: { value: '1' } })
    expect(onConfigChange).toHaveBeenLastCalledWith({ ...three, driversPerRace: 2 })
  })

  test('a driver dragged out of the practices runs none; one who runs none is dragged into a practice', () => {
    const { onPracticeGroupsChange } = configure({ practices: [['d1', 'd2']] })
    const out = screen.getByTestId('championship-wizard-no-practice')
    const [fp1] = screen.getAllByTestId('championship-wizard-practice')
    drag(within(out).getByText('Cid'), fp1)
    expect(onPracticeGroupsChange).toHaveBeenLastCalledWith([['d1', 'd2', 'd3']])
    drag(within(fp1).getByText('Ana'), out)
    expect(onPracticeGroupsChange).toHaveBeenLastCalledWith([['d2']])
  })

  test('each card changes its own limits; practices may have none', async () => {
    const { onConfigChange } = configure()
    const practice = within(screen.getByTestId('championship-wizard-practice-limits'))
    expect(practice.getByText('Optional: without a limit, the practice is ended by hand.')).toBeInTheDocument()
    await userEvent.click(practice.getByRole('checkbox', { name: 'Laps' }))
    expect(onConfigChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      practice: { ...DEFAULT_WIZARD_CONFIG.practice, useLaps: true },
    })
    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Duration' }))
    expect(onConfigChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      qualif: { ...DEFAULT_WIZARD_CONFIG.qualif, useTime: false },
    })
    const race = within(screen.getByTestId('championship-wizard-race-limits'))
    fireEvent.change(race.getByRole('spinbutton', { name: 'Duration' }), { target: { value: '' } })
    expect(onConfigChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      race: { ...DEFAULT_WIZARD_CONFIG.race, duration: 1 },
    })
  })

  test('laps, at least one', () => {
    const laps = { ...DEFAULT_WIZARD_CONFIG.qualif, useLaps: true, laps: 5 }
    const { onConfigChange } = configure({ config: { ...DEFAULT_WIZARD_CONFIG, qualif: laps } })
    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    fireEvent.change(qualif.getByRole('spinbutton', { name: 'Laps' }), { target: { value: '' } })
    expect(onConfigChange).toHaveBeenLastCalledWith({ ...DEFAULT_WIZARD_CONFIG, qualif: { ...laps, laps: 1 } })
  })

  // Ana and Cid share the Ferrari
  const threeDrivers = [entry(drivers[0], 'ferrari'), entry(drivers[1]), entry(drivers[2], 'ferrari')]

  test('a driver dragged to another group, unless their car already runs there', () => {
    const groups = [['d1', 'd2'], ['d3']]
    const { onQualifGroupsChange } = configure({ participants: threeDrivers, groups })
    const [q1, q2] = screen.getAllByTestId('championship-wizard-qualif-group')
    drag(within(q1).getByText('Ben'), q2)
    expect(onQualifGroupsChange).toHaveBeenCalledWith([['d1'], ['d3', 'd2']])
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    drag(within(q1).getByText('Ana'), q2)
    expect(onQualifGroupsChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent("Refused: Ana's car already runs in this session with Cid.")
  })

  test('a driver dragged between free practices, which may be left empty', () => {
    const { onPracticeGroupsChange } = configure({ participants: threeDrivers, practices: [['d2'], ['d1'], ['d3']] })
    const [fp1, fp2] = screen.getAllByTestId('championship-wizard-practice')
    drag(within(fp1).getByText('Ben'), fp2)
    expect(onPracticeGroupsChange).toHaveBeenCalledWith([[], ['d1', 'd2'], ['d3']])
  })

  test('the group hovered shows where the driver would land, refused in red, until the drag leaves', () => {
    configure({ participants: threeDrivers, groups: [['d1', 'd2'], ['d3']] })
    const [q1, q2] = screen.getAllByTestId('championship-wizard-qualif-group')
    fireEvent.dragStart(within(q1).getByText('Ben'))
    fireEvent.dragOver(q2)
    expect(ghost(q2)).toBe('+Ben')
    expect(ghost(q1)).toBeUndefined()
    fireEvent.dragLeave(q2, { relatedTarget: document.body })
    expect(ghost(q2)).toBeUndefined()
    fireEvent.dragEnd(within(q1).getByText('Ben'))

    fireEvent.dragStart(within(q1).getByText('Ana'))
    fireEvent.dragOver(q2)
    expect(ghost(q2)).toBe('✕Ana')
    fireEvent.dragEnd(within(q1).getByText('Ana'))
    expect(ghost(q2)).toBeUndefined()
  })
})

describe('WizardManualConfig', () => {
  // Ana and Cid share the Ferrari; FP1 Cid, Q1 Ana Ben, Q2 Cid, R1 empty; Dan aside
  const participants = [
    entry(drivers[0], 'ferrari'),
    entry(drivers[1]),
    entry(drivers[2], 'ferrari'),
    entry(drivers[3]),
  ]
  const slots = (ids) => Array.from({ length: 6 }, (_, k) => ids[k] ?? null)
  const initialPlan = [
    { key: 'p', type: PRACTICE, slots: slots(['d3']) },
    { key: 'q1', type: QUALIF, slots: slots(['d1', 'd2']) },
    { key: 'q2', type: QUALIF, slots: slots(['d3']) },
    { key: 'r', type: RACE, slots: slots([]) },
  ]

  function Harness({ onConfigChange }) {
    const [plan, setPlan] = useState(initialPlan)
    return (
      <WizardManualConfig
        config={DEFAULT_WIZARD_CONFIG}
        participants={participants}
        plan={plan}
        onConfigChange={onConfigChange}
        onPlanChange={setPlan}
      />
    )
  }
  const show = () => {
    const onConfigChange = vi.fn()
    render(<Harness onConfigChange={onConfigChange} />)
    return onConfigChange
  }
  const lane = (index) => screen.getAllByTestId('championship-wizard-session')[index]
  const slot = (index, k) => within(lane(index)).getAllByTestId('championship-wizard-slot')[k]

  test('the sessions in running order with their controllers, the drivers in none aside', () => {
    show()
    expect(lanes()).toEqual([
      { title: 'FP11 / 6', drivers: ['Cid'] },
      { title: 'Q12 / 6', drivers: ['Ana', 'Ben'] },
      { title: 'Q21 / 6', drivers: ['Cid'] },
      { title: 'R10 / 6', drivers: [] },
    ])
    expect(within(lane(3)).getAllByText('Free')).toHaveLength(6)
    expect(benchNames()).toEqual(['Dan'])
  })

  test('a driver dragged from aside onto a controller, or set aside again', async () => {
    show()
    drag(within(screen.getByTestId('championship-wizard-bench')).getByText('Dan'), slot(3, 2))
    expect(lanes()[3]).toEqual({ title: 'R11 / 6', drivers: ['Dan'] })
    expect(benchNames()).toEqual([])
    expect(screen.getByTestId('championship-wizard-bench')).toHaveTextContent('Every driver is placed')

    await userEvent.click(within(lane(1)).getByRole('button', { name: 'Set Ben aside' }))
    expect(lanes()[1].drivers).toEqual(['Ana'])
    expect(benchNames()).toEqual(['Ben'])
  })

  test('a driver dragged to the drivers aside leaves the session', () => {
    show()
    drag(within(lane(1)).getByText('Ana'), screen.getByTestId('championship-wizard-bench'))
    expect(lanes()[1].drivers).toEqual(['Ben'])
    expect(benchNames()).toEqual(['Ana', 'Dan'])
  })

  test("refused: a car already in the session, and the plan doesn't change", () => {
    show()
    drag(within(lane(2)).getByText('Cid'), slot(1, 3))
    expect(screen.getByRole('status')).toHaveTextContent("Refused: Cid's car already runs in this session with Ana.")
    expect(lanes()[1].drivers).toEqual(['Ana', 'Ben'])
    expect(lanes()[2].drivers).toEqual(['Cid'])
  })

  test('the controller hovered shows who would land there, swapping or refused', () => {
    show()
    const bench = screen.getByTestId('championship-wizard-bench')
    fireEvent.dragStart(within(lane(1)).getByText('Ana'))
    fireEvent.dragOver(slot(3, 0))
    expect(ghost(slot(3, 0))).toBe('+Ana')
    // Cid would take Ana's place in Q1
    fireEvent.dragOver(slot(2, 0))
    expect(ghost(slot(2, 0))).toBe('+Ana ⇄ Cid')
    expect(ghost(slot(3, 0))).toBeUndefined()
    // Cid runs the Ferrari in FP1
    fireEvent.dragOver(slot(0, 1))
    expect(ghost(slot(0, 1))).toBe('✕Ana')
    fireEvent.dragEnd(within(lane(1)).getByText('Ana'))
    expect(screen.queryByTestId('wizard-drop-ghost')).not.toBeInTheDocument()

    // Cid can't take Ben's place next to Ana: he would go aside, not swap
    fireEvent.dragStart(within(lane(1)).getByText('Ben'))
    fireEvent.dragOver(slot(0, 0))
    expect(ghost(slot(0, 0))).toBe('+Ben')
    fireEvent.dragOver(bench)
    expect(ghost(bench)).toBe('+Ben')
  })

  test('a session dragged by its header takes the place of another, a bar showing where', () => {
    show()
    fireEvent.dragStart(lane(3).firstChild)
    fireEvent.dragOver(lane(0).firstChild)
    expect(within(lane(0)).getByTestId('championship-wizard-insertion')).toBeInTheDocument()
    fireEvent.drop(lane(0).firstChild)
    expect(lanes().map((l) => l.title)).toEqual(['R10 / 6', 'FP11 / 6', 'Q12 / 6', 'Q21 / 6'])
    expect(screen.queryByTestId('championship-wizard-insertion')).not.toBeInTheDocument()
    // A driver dragged onto a header is not a session move
    drag(within(lane(2)).getByText('Ana'), lane(0).firstChild)
    expect(lanes().map((l) => l.title)).toEqual(['R10 / 6', 'FP11 / 6', 'Q12 / 6', 'Q21 / 6'])
  })

  test('sessions added or removed by kind', () => {
    show()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Qualifications' }), { target: { value: '3' } })
    expect(lanes().map((l) => l.title)).toEqual(['FP11 / 6', 'Q12 / 6', 'Q21 / 6', 'Q30 / 6', 'R10 / 6'])
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Races' }), { target: { value: '0' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Free practices' }), { target: { value: '2' } })
    expect(lanes().map((l) => l.title)).toEqual(['FP11 / 6', 'FP20 / 6', 'Q12 / 6', 'Q21 / 6', 'Q30 / 6'])
  })

  test('the limits of a kind open from its pill', async () => {
    const onConfigChange = show()
    expect(screen.queryByTestId('championship-wizard-qualif-limits')).not.toBeInTheDocument()
    const pill = screen.getByRole('button', { name: 'Q: 5 min' })
    expect(screen.getByRole('button', { name: 'FP: no limit' })).toBeInTheDocument()
    await userEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Laps' }))
    expect(onConfigChange).toHaveBeenCalledWith({
      ...DEFAULT_WIZARD_CONFIG,
      qualif: { ...DEFAULT_WIZARD_CONFIG.qualif, useLaps: true },
    })
    await userEvent.click(pill)
    expect(screen.queryByTestId('championship-wizard-qualif-limits')).not.toBeInTheDocument()
  })
})

describe('WizardConfigStep', () => {
  const participants = drivers.slice(0, 5).map((d) => entry(d))
  const plan = [
    { key: 'q', type: QUALIF, slots: Array(6).fill(null) },
    { key: 'r', type: RACE, slots: Array(6).fill(null) },
  ]

  function configure(mode, more = {}) {
    const props = {
      onModeChange: vi.fn(),
      onConfigChange: vi.fn(),
      onPracticeGroupsChange: vi.fn(),
      onQualifGroupsChange: vi.fn(),
      onPlanChange: vi.fn(),
    }
    render(
      <WizardConfigStep
        mode={mode}
        config={DEFAULT_WIZARD_CONFIG}
        participants={participants}
        practiceGroups={dealtPracticeGroups(participants, 1)}
        qualifGroups={dealtQualifGroups(participants, 4)}
        plan={mode === ChampionshipMode.MANUAL ? plan : null}
        {...props}
        {...more}
      />
    )
    return props
  }
  const total = () => screen.getByTestId('championship-wizard-total').textContent

  test('automatic by default: the sessions the settings make', async () => {
    const { onModeChange } = configure(ChampionshipMode.AUTO)
    expect(screen.getByRole('radio', { name: 'Automatic' })).toBeChecked()
    expect(total()).toBe('Total: 4 sessions (1 FP + 2 qualifs + 1 race)')
    await userEvent.click(screen.getByRole('radio', { name: 'Automatic' }))
    expect(onModeChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('radio', { name: 'Manual' }))
    expect(onModeChange).toHaveBeenCalledWith(ChampionshipMode.MANUAL)
  })

  test('manual: the sessions planned; back to automatic once confirmed', async () => {
    const { onModeChange } = configure(ChampionshipMode.MANUAL)
    expect(screen.getByRole('radio', { name: 'Manual' })).toBeChecked()
    expect(total()).toBe('Total: 2 sessions (1 qualif + 1 race)')
    await userEvent.click(screen.getByRole('radio', { name: 'Automatic' }))
    expect(screen.getByText('Everything will be dealt again: the changes made by hand will be lost.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onModeChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('radio', { name: 'Automatic' }))
    await userEvent.click(screen.getByRole('button', { name: 'Deal again' }))
    expect(onModeChange).toHaveBeenCalledWith(ChampionshipMode.AUTO)
    expect(screen.queryByText('Back to automatic?')).not.toBeInTheDocument()
  })
})

describe('ChampionshipWizard', () => {
  function api(created = { success: true, data: { id: 'c9' } }) {
    return routeFetch({
      '/api/drivers': { success: true, data: drivers },
      '/api/cars': { success: true, data: cars },
      'POST /api/championships': created,
    })
  }

  function open() {
    const handlers = { onClose: vi.fn(), onCreated: vi.fn() }
    render(<ChampionshipWizard tracks={tracks} {...handlers} />)
    return handlers
  }

  const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }))
  const create = () => userEvent.click(screen.getByRole('button', { name: 'Create championship' }))
  const sent = (mock) => JSON.parse(mock.mock.calls.find(([, init]) => init?.method === 'POST')[1].body)

  // Picks drivers[from..to[ in the empty row, one after the other
  async function pickDrivers(from, to) {
    for (let i = from; i < to; i++) {
      const selects = await screen.findAllByRole('combobox', { name: 'Driver' })
      await userEvent.selectOptions(selects.at(-1), drivers[i].id)
    }
  }

  async function toConfig() {
    const handlers = open()
    await userEvent.type(field('Championship name'), 'Cup')
    await userEvent.selectOptions(field('Track'), 't1')
    await next()
    await pickDrivers(0, 3)
    await next()
    return handlers
  }

  test('each step must be complete to go on', async () => {
    api()
    open()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.type(field('Championship name'), 'C')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await userEvent.selectOptions(field('Track'), 't1')
    await next()

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await pickDrivers(0, 1)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await pickDrivers(1, 3)
    await next()

    const qualif = within(screen.getByTestId('championship-wizard-qualif-limits'))
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Duration' }))
    expect(screen.getByRole('button', { name: 'Create championship' })).toBeDisabled()
    await userEvent.click(qualif.getByRole('checkbox', { name: 'Laps' }))
    expect(screen.getByRole('button', { name: 'Create championship' })).toBeEnabled()
  })

  test('back, or a step done, returns to it with its values', async () => {
    api()
    await toConfig()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('3 participants')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Info' }))
    expect(field('Championship name')).toHaveValue('Cup')
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  test('automatic: creates the championship with the cars and the groups as moved, then closes', async () => {
    const mock = api()
    const { onCreated, onClose } = await toConfig()
    fireEvent.change(screen.getByRole('spinbutton', { name: /drivers per qualif/ }), { target: { value: '2' } })
    const [q1, q2] = screen.getAllByTestId('championship-wizard-qualif-group')
    drag(within(q1).getByText('Cid'), q2)
    fireEvent.change(screen.getByRole('spinbutton', { name: /free practice in all/ }), { target: { value: '2' } })
    const [fp1, fp2] = screen.getAllByTestId('championship-wizard-practice')
    drag(within(fp1).getByText('Cid'), fp2)
    await create()
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'c9' }))
    expect(onClose).toHaveBeenCalled()
    expect(sent(mock)).toMatchObject({
      name: 'Cup',
      trackId: 't1',
      mode: ChampionshipMode.AUTO,
      driversPerQualif: 2,
      participants: [
        { driverId: 'd1', carId: 'ferrari' },
        { driverId: 'd2', carId: null },
        { driverId: 'd3', carId: null },
      ],
      practiceCount: 2,
      practiceGroups: [['d1'], ['d2', 'd3']],
      qualifGroups: [['d1'], ['d2', 'd3']],
    })
  })

  test('manual: starts from the automatic split and creates the sessions as planned', async () => {
    const mock = api()
    await toConfig()
    await userEvent.click(screen.getByRole('radio', { name: 'Manual' }))
    expect(lanes()).toEqual([
      { title: 'FP13 / 6', drivers: ['Ana', 'Ben', 'Cid'] },
      { title: 'Q13 / 6', drivers: ['Ana', 'Ben', 'Cid'] },
      { title: 'R13 / 6', drivers: ['Ana', 'Ben', 'Cid'] },
    ])
    const qualif = screen.getAllByTestId('championship-wizard-session')[1]
    await userEvent.click(within(qualif).getByRole('button', { name: 'Set Ben aside' }))
    await create()
    await waitFor(() => expect(mock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const body = sent(mock)
    expect(body).toMatchObject({ mode: ChampionshipMode.MANUAL })
    expect(body.sessions).toEqual([
      {
        type: PRACTICE,
        drivers: [
          { driverId: 'd1', controller: 0 },
          { driverId: 'd2', controller: 1 },
          { driverId: 'd3', controller: 2 },
        ],
      },
      {
        type: QUALIF,
        drivers: [
          { driverId: 'd1', controller: 0 },
          { driverId: 'd3', controller: 2 },
        ],
      },
      {
        type: RACE,
        drivers: [
          { driverId: 'd1', controller: 0 },
          { driverId: 'd2', controller: 1 },
          { driverId: 'd3', controller: 2 },
        ],
      },
    ])
    expect(body).not.toHaveProperty('qualifGroups')
  })

  test('manual: a changed line-up keeps the plan, newcomers aside; back to automatic deals again', async () => {
    api()
    await toConfig()
    await userEvent.click(screen.getByRole('radio', { name: 'Manual' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[2])
    await pickDrivers(3, 4)
    await next()
    expect(lanes().map((l) => l.drivers)).toEqual([
      ['Ana', 'Ben'],
      ['Ana', 'Ben'],
      ['Ana', 'Ben'],
    ])
    expect(benchNames()).toEqual(['Dan'])
    // Wider for the lanes
    expect(screen.getByTestId('modal').firstChild).toHaveClass('max-w-7xl')

    await userEvent.click(screen.getByRole('radio', { name: 'Automatic' }))
    await userEvent.click(screen.getByRole('button', { name: 'Deal again' }))
    expect(screen.getAllByTestId('championship-wizard-qualif-group').map((g) => g.textContent)).toEqual([
      'Q13 / 4AnaBenDanFree place',
    ])
    expect(screen.getAllByTestId('championship-wizard-practice').map((g) => g.textContent)).toEqual([
      'FP13 / 6AnaBenDanFree place',
    ])
  })

  test("the server's refusal, or a generic message, keeps the wizard open", async () => {
    api({ success: false, error: 'Track busy' })
    const { onClose } = await toConfig()
    await create()
    expect(await screen.findByText('Track busy')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    cleanup()
    api({ success: false })
    await toConfig()
    await create()
    expect(await screen.findByText('Error during creation')).toBeInTheDocument()
  })

  test('the server cannot be reached', async () => {
    api(new Error('offline'))
    await toConfig()
    await create()
    expect(await screen.findByText('Server connection error')).toBeInTheDocument()
  })

  test('without drivers from the server, the list stays empty; cancel closes', async () => {
    routeFetch({ '/api/drivers': { success: false }, '/api/cars': new Error('offline') })
    const { onClose } = open()
    await userEvent.type(field('Championship name'), 'Cup')
    await userEvent.selectOptions(field('Track'), 't1')
    await next()
    expect(within(screen.getByRole('combobox', { name: 'Driver' })).getAllByRole('option')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ChampionshipWizard editing a championship under way', () => {
  const [ana, ben, cid, dan] = drivers
  const seat = (driver, controller, finalPos = null) => ({
    id: `${driver.id}-${controller}`,
    driverId: driver.id,
    driver,
    carId: null,
    car: null,
    controller,
    finalPos,
  })
  const session = (id, type, status, order, seats = [], extra = {}) => ({
    id,
    type,
    status,
    order,
    drivers: seats,
    withdrawals: [],
    ...extra,
  })
  const championshipOf = (mode, lineUp, extra = {}) => ({
    id: 'c1',
    name: 'Cup',
    trackId: 't1',
    mode,
    status: ChampionshipStatus.ACTIVE,
    driversPerQualif: 2,
    driversPerRace: 4,
    qualifMaxDuration: 300000,
    raceMaxDuration: 600000,
    divisions: [],
    participants: lineUp.map((driver) => ({ driverId: driver.id, driver, carId: null })),
    ...extra,
  })

  function edit(championship, sessions) {
    const mock = routeFetch({ ...divisionRoutes, 'PUT /api/championships/c1/plan': { success: true, data: {} } })
    const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onFinish: vi.fn(), onReopen: vi.fn() }
    render(
      <ChampionshipWizard
        tracks={tracks}
        championship={championship}
        sessions={sessions}
        drivers={drivers}
        cars={cars}
        {...handlers}
      />
    )
    return { mock, handlers }
  }
  const tab = (name) => userEvent.click(screen.getByRole('button', { name }))
  const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }))
  const saved = (mock) => JSON.parse(mock.mock.calls.find(([, init]) => init?.method === 'PUT')[1].body)
  const frozen = () => screen.getAllByTestId('championship-wizard-frozen').map((s) => s.textContent)

  test('automatic: the sessions that ran stay as they ran, those to come are dealt and saved', async () => {
    const sessions = [
      session('q1', QUALIF, FINISHED, 0, [seat(ana, 0, 2), seat(ben, 1, 1)]),
      session('q2', QUALIF, DRAFT, 1, [seat(cid, 0), seat(dan, 1)]),
      session('r1', RACE, DRAFT, 2),
    ]
    const { mock, handlers } = edit(championshipOf(ChampionshipMode.AUTO, [ana, ben, cid, dan]), sessions)

    expect(field('Track')).toBeDisabled()
    expect(screen.getByText('Locked: 1 session has run on this track.')).toBeInTheDocument()
    await tab('Configuration')
    expect(frozen()).toEqual(['Q1FinishedP1BenP2Ana'])
    const groups = screen.getAllByTestId('championship-wizard-qualif-group')
    expect(groups.map((g) => g.textContent)).toEqual([expect.stringMatching(/^Q22 \/ 2CidDan/)])
    expect(screen.getByTestId('championship-wizard-total')).toHaveTextContent('To come: 2 sessions')

    await save()
    expect(saved(mock)).toMatchObject({
      mode: ChampionshipMode.AUTO,
      participants: [ana, ben, cid, dan].map((d) => ({ driverId: d.id, carId: null })),
      practiceGroups: [],
      qualifGroups: [[cid.id, dan.id]],
    })
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
    expect(handlers.onClose).toHaveBeenCalled()
  })

  test('manual: a driver who raced and is taken out is DNF where they were to run, until restored', async () => {
    const sessions = [
      session('q1', QUALIF, FINISHED, 0, [seat(ana, 0, 1), seat(ben, 1, 2)]),
      session('r1', RACE, DRAFT, 1, [seat(ana, 0), seat(ben, 1), seat(cid, 2)]),
    ]
    const { mock } = edit(championshipOf(ChampionshipMode.MANUAL, [ana, ben, cid]), sessions)

    await tab('Drivers')
    const benRow = screen.getAllByTestId('wizard-participant')[1]
    await userEvent.click(within(benRow).getByRole('button', { name: 'Delete' }))
    expect(screen.getByTestId('wizard-retired')).toHaveTextContent('BenWithdrawn · DNF in R1')

    await tab('Configuration')
    expect(lanes()).toEqual([{ title: 'R12 / 6', drivers: ['Ana', 'Cid'] }])
    // The counts are all the sessions: never fewer than those that ran
    expect(field('Qualifications')).toHaveValue(1)
    fireEvent.change(field('Qualifications'), { target: { value: '0' } })
    expect(field('Qualifications')).toHaveValue(1)
    expect(field('Races')).toHaveValue(1)
    expect(screen.getByTestId('wizard-withdrawn')).toHaveTextContent('BenDNF · withdrawn')
    drag(
      within(screen.getAllByTestId('championship-wizard-session')[0]).getAllByTestId('wizard-driver')[1],
      screen.getByTestId('championship-wizard-frozen')
    )
    expect(screen.getByText('Refused: Q1 has already run, its grid no longer changes.')).toBeInTheDocument()

    await save()
    expect(saved(mock)).toMatchObject({
      mode: ChampionshipMode.MANUAL,
      participants: [{ driverId: ana.id }, { driverId: cid.id }],
      sessions: [
        {
          id: 'r1',
          type: RACE,
          drivers: [
            { driverId: ana.id, controller: 0 },
            { driverId: cid.id, controller: 2 },
          ],
        },
      ],
    })
  })

  test('a driver restored is back in the line-up and DNF nowhere', async () => {
    const sessions = [session('q1', QUALIF, FINISHED, 0, [seat(ana, 0, 1), seat(ben, 1, 2)])]
    edit(championshipOf(ChampionshipMode.MANUAL, [ana, cid]), sessions)

    await tab('Drivers')
    expect(screen.getByTestId('wizard-retired')).toHaveTextContent('BenWithdrawn')
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(screen.queryByTestId('wizard-retired')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('wizard-participant')).toHaveLength(4)
  })

  test('a finished championship is locked: it can only be reopened', async () => {
    const { handlers } = edit(
      championshipOf(ChampionshipMode.AUTO, [ana, ben], { status: ChampionshipStatus.FINISHED }),
      []
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Reopen championship' }))
    expect(handlers.onReopen).toHaveBeenCalled()
  })
})
