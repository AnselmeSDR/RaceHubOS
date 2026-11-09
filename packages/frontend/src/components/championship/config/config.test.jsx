import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChampionshipMode, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch, withStatus } from '@/test/helpers'
import ChampionshipConfigModal from '../ChampionshipConfigModal'
import ChampionshipConfigFooter from './ChampionshipConfigFooter'
import ChampionshipInfoFields from './ChampionshipInfoFields'
import ChampionshipParticipantsPanel from './ChampionshipParticipantsPanel'
import ChampionshipSessionsPanel from './ChampionshipSessionsPanel'
import ConfigSessionRow from './ConfigSessionRow'
import SessionLimitsEditor from './SessionLimitsEditor'
import SessionLimitsFields from './SessionLimitsFields'
import {
  addChampionshipSession,
  reopenChampionship,
  saveChampionshipInfo,
  setChampionshipParticipants,
  swapSessionOrder,
  updateSessionLimits,
} from './championshipConfigApi'
import {
  NEW_SESSION_FORM,
  limitsBody,
  limitsText,
  nextSessionLabel,
  qualifRaceSessions,
  sessionFormOf,
  sessionLabel,
} from './sessionLimits'

const drivers = [
  { id: 'd1', name: 'Ana', img: '/uploads/ana.png' },
  { id: 'd2', name: 'Ben' },
  { id: 'd3', name: 'Cid' },
]
const tracks = [
  { id: 't1', name: 'Monza' },
  { id: 't2', name: 'Spa' },
]
const draft = (id, type, extra = {}) => ({ id, type, status: SessionStatus.DRAFT, ...extra })
const q1 = draft('q1', SessionType.QUALIF, { order: 0, maxDuration: 300000 })
const q2 = draft('q2', SessionType.QUALIF, { order: 1, maxLaps: 12 })
const r1 = draft('r1', SessionType.RACE, { order: 2, name: 'Final', maxDuration: 600000, maxLaps: 20 })
const practice = draft('p', SessionType.PRACTICE, { order: -1 })
const championship = {
  id: 'c1',
  name: 'Cup',
  trackId: 't1',
  mode: ChampionshipMode.MANUAL,
  status: ChampionshipStatus.PLANNED,
}
const auto = {
  ...championship,
  mode: ChampionshipMode.AUTO,
  participants: [
    { id: 'p1', driverId: 'd1', driver: drivers[0] },
    { id: 'p2', driverId: 'd2', driver: drivers[1] },
  ],
}
const finished = { ...championship, status: ChampionshipStatus.FINISHED }

const bodyOf = (mock, method, url) =>
  JSON.parse(mock.mock.calls.find(([u, init]) => init?.method === method && (!url || u === url))[1].body)

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('session limits', () => {
  test('the form of a session, the defaults where it has no limit', () => {
    expect(sessionFormOf({ name: 'GP', maxDuration: 420000, maxLaps: 15 })).toEqual({
      name: 'GP',
      duration: 7,
      maxLaps: 15,
      useTime: true,
      useLaps: true,
    })
    expect(sessionFormOf({})).toEqual({ name: '', duration: 5, maxLaps: 10, useTime: false, useLaps: false })
  })

  test('only the ticked limits are sent, minutes in ms', () => {
    expect(limitsBody({ duration: 3, maxLaps: 9, useTime: true, useLaps: false })).toEqual({
      maxDuration: 180000,
      maxLaps: null,
    })
    expect(limitsBody({ duration: 3, maxLaps: 9, useTime: false, useLaps: true })).toEqual({
      maxDuration: null,
      maxLaps: 9,
    })
  })

  test('qualifying sessions and races in running order, the oldest first on a tie', () => {
    const late = draft('late', SessionType.RACE, { createdAt: '2026-02-01' })
    const early = draft('early', SessionType.RACE, { createdAt: '2026-01-01' })
    expect(qualifRaceSessions([r1, practice, late, q2, early, q1]).map((s) => s.id)).toEqual([
      'early',
      'late',
      'q1',
      'q2',
      'r1',
    ])
  })

  test('labels: rank among the sessions of the same type', () => {
    const scheduled = [q1, q2, r1]
    expect(sessionLabel(q2, scheduled)).toBe('Q2')
    expect(sessionLabel(r1, scheduled)).toBe('R1')
    expect(nextSessionLabel(SessionType.QUALIF, scheduled)).toBe('Q3')
    expect(nextSessionLabel(SessionType.RACE, [])).toBe('R1')
  })

  test('limits shown as minutes and laps', () => {
    expect(limitsText(r1)).toBe('10min / 20t')
    expect(limitsText(q1)).toBe('5min')
    expect(limitsText(q2)).toBe('12t')
    expect(limitsText({})).toBe('')
  })
})

describe('championship config API', () => {
  test('saving the name, trimmed, and the track, none when emptied', async () => {
    const mock = routeFetch({ 'PUT /api/championships/c1': { success: true, data: { id: 'c1' } } })
    expect(await saveChampionshipInfo('c1', { name: ' Cup ', trackId: '' }, 'x')).toEqual({ id: 'c1' })
    expect(bodyOf(mock, 'PUT')).toEqual({ name: 'Cup', trackId: null })
  })

  test("a refused save throws the server's error, or the fallback", async () => {
    routeFetch({ 'PUT /api/championships/c1': withStatus(409, { error: 'Taken' }) })
    await expect(saveChampionshipInfo('c1', { name: 'a', trackId: 't1' }, 'x')).rejects.toThrow('Taken')
    routeFetch({ 'PUT /api/championships/c1': 500 })
    await expect(saveChampionshipInfo('c1', { name: 'a', trackId: 't1' }, 'fallback')).rejects.toThrow('fallback')
  })

  test('reopening plans the championship again, null when refused', async () => {
    const mock = routeFetch({ 'PUT /api/championships/c1': { success: true, data: { id: 'c1' } } })
    expect(await reopenChampionship('c1')).toEqual({ id: 'c1' })
    expect(bodyOf(mock, 'PUT')).toEqual({ status: ChampionshipStatus.PLANNED })
    routeFetch({ 'PUT /api/championships/c1': 400 })
    expect(await reopenChampionship('c1')).toBeNull()
  })

  test('participants are sent with the names of the sessions to create', async () => {
    const mock = routeFetch({ 'PUT /api/championships/c1/participants': { success: true } })
    await setChampionshipParticipants('c1', ['d1', 'd2'], 'x')
    expect(bodyOf(mock, 'PUT')).toEqual({
      participants: [{ driverId: 'd1' }, { driverId: 'd2' }],
      sessionNames: expect.objectContaining({ [SessionType.RACE]: 'Race' }),
    })
    routeFetch({ 'PUT /api/championships/c1/participants': 400 })
    await expect(setChampionshipParticipants('c1', [], 'fallback')).rejects.toThrow('fallback')
  })

  test('a new session, unnamed, at the end of the running order', async () => {
    const mock = routeFetch({ 'POST /api/championships/c1/sessions': { success: true } })
    await addChampionshipSession('c1', { type: SessionType.RACE, form: NEW_SESSION_FORM, order: 3 }, 'x')
    expect(bodyOf(mock, 'POST')).toEqual({ type: SessionType.RACE, maxDuration: 300000, maxLaps: null, order: 3 })
    routeFetch({ 'POST /api/championships/c1/sessions': withStatus(400, { error: 'No track' }) })
    await expect(
      addChampionshipSession('c1', { type: SessionType.RACE, form: NEW_SESSION_FORM, order: 0 }, 'x')
    ).rejects.toThrow('No track')
  })

  test('limits and running order of the sessions', async () => {
    const mock = routeFetch({ 'PUT /api/sessions': { success: true } })
    await updateSessionLimits('q1', { ...NEW_SESSION_FORM, useLaps: true })
    expect(bodyOf(mock, 'PUT', '/api/sessions/q1')).toEqual({ name: null, maxDuration: 300000, maxLaps: 10 })
    mock.mockClear()
    await swapSessionOrder(q1, 0, q2, 1)
    expect(bodyOf(mock, 'PUT', '/api/sessions/q1')).toEqual({ order: 1 })
    expect(bodyOf(mock, 'PUT', '/api/sessions/q2')).toEqual({ order: 0 })
  })
})

describe('SessionLimitsFields', () => {
  test('each limit is used only when ticked', async () => {
    const onChange = vi.fn()
    render(<SessionLimitsFields form={NEW_SESSION_FORM} onChange={onChange} />)
    const [duration, laps] = screen.getAllByRole('spinbutton')
    expect(duration).toBeEnabled()
    expect(laps).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'laps' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...NEW_SESSION_FORM, useLaps: true })
    await userEvent.click(screen.getByRole('checkbox', { name: 'min' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...NEW_SESSION_FORM, useTime: false })
    fireEvent.change(duration, { target: { value: '8' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...NEW_SESSION_FORM, duration: 8 })
    fireEvent.change(duration, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...NEW_SESSION_FORM, duration: 1 })
  })

  test('laps, at least one', () => {
    const onChange = vi.fn()
    const form = { ...NEW_SESSION_FORM, useLaps: true }
    render(<SessionLimitsFields form={form} onChange={onChange} />)
    const laps = screen.getAllByRole('spinbutton')[1]
    fireEvent.change(laps, { target: { value: '25' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...form, maxLaps: 25 })
    fireEvent.change(laps, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...form, maxLaps: 1 })
  })
})

describe('SessionLimitsEditor', () => {
  test('name, confirm and cancel', async () => {
    const props = { onChange: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() }
    render(<SessionLimitsEditor type={SessionType.RACE} label="R2" form={NEW_SESSION_FORM} {...props} />)
    expect(screen.getByText('R2')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Race'), 'G')
    expect(props.onChange).toHaveBeenCalledWith({ ...NEW_SESSION_FORM, name: 'G' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onConfirm).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalled()
  })

  test('a labelled confirm, disabled on demand', () => {
    render(
      <SessionLimitsEditor
        type={SessionType.QUALIF}
        label="Q1"
        form={NEW_SESSION_FORM}
        onChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmLabel="Create"
        confirmDisabled
      />
    )
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Qualification')).toBeInTheDocument()
  })
})

describe('ConfigSessionRow', () => {
  const row = (session, props = {}) => {
    const handlers = { onMove: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }
    render(<ConfigSessionRow session={session} label="Q1" first last={false} {...handlers} {...props} />)
    return handlers
  }

  test('a draft moves, opens for editing, is deleted', async () => {
    const { onMove, onEdit, onDelete } = row(q1)
    expect(screen.getByText('Qualification')).toBeInTheDocument()
    expect(screen.getByText('5min')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Move down' }))
    expect(onMove).toHaveBeenCalledWith('down')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalled()
  })

  test('the last one cannot go down; a locked championship changes nothing', async () => {
    row(r1, { first: false, last: true })
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move up' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move down' })).toBeDisabled()
    cleanup()
    row(q1, { locked: true })
    for (const name of ['Move up', 'Move down', 'Edit', 'Delete']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })

  test('a started session only shows its status', () => {
    row({ ...q1, status: SessionStatus.ACTIVE })
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    cleanup()
    row({ ...q1, status: 'unheard-of' })
    expect(screen.getByText('unheard-of')).toBeInTheDocument()
  })
})

describe('ChampionshipSessionsPanel', () => {
  function panel(props = {}) {
    const handlers = { onChanged: vi.fn(), onError: vi.fn() }
    render(<ChampionshipSessionsPanel championship={championship} sessions={[]} {...handlers} {...props} />)
    return handlers
  }

  test('none yet: add a qualifying session at the end of the order', async () => {
    const mock = routeFetch({ 'POST /api/championships/c1/sessions': { success: true } })
    const { onChanged } = panel({ sessions: [practice] })
    expect(screen.getByText('No session. Add a qualification or a race.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Qualif' }))
    expect(screen.queryByText(/No session/)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('config-session-editor')).getByText('Q1')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Qualification'), 'Heat')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(bodyOf(mock, 'POST')).toEqual({
      type: SessionType.QUALIF,
      name: 'Heat',
      maxDuration: 300000,
      maxLaps: null,
      order: 0,
    })
    expect(screen.queryByTestId('config-session-editor')).not.toBeInTheDocument()
  })

  test('a race needs a limit; a refused creation reports its error and stays open', async () => {
    routeFetch({ 'POST /api/championships/c1/sessions': withStatus(400, { error: 'No track' }) })
    const { onError, onChanged } = panel({ sessions: [q1] })
    await userEvent.click(screen.getByRole('button', { name: 'Race' }))
    expect(within(screen.getByTestId('config-session-editor')).getByText('R1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'min' }))
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'laps' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('No track'))
    expect(onChanged).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByTestId('config-session-editor')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('config-session-editor')).not.toBeInTheDocument()
  })

  test('editing a session sends its new limits', async () => {
    const mock = routeFetch({ 'PUT /api/sessions/q2': { success: true } })
    const { onChanged } = panel({ sessions: [q2, q1] })
    const [, second] = screen.getAllByTestId('config-session-row')
    await userEvent.click(within(second).getByRole('button', { name: 'Edit' }))
    const editor = screen.getByTestId('config-session-editor')
    expect(within(editor).getByText('Q2')).toBeInTheDocument()
    await userEvent.type(within(editor).getByPlaceholderText('Qualification'), 'Last chance')
    await userEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(bodyOf(mock, 'PUT')).toEqual({ name: 'Last chance', maxDuration: null, maxLaps: 12 })
    expect(screen.queryByTestId('config-session-editor')).not.toBeInTheDocument()
  })

  test('cancelling an edit keeps the session', async () => {
    const mock = routeFetch({})
    panel({ sessions: [q1] })
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('config-session-row')).toBeInTheDocument()
    expect(mock).not.toHaveBeenCalled()
  })

  test('moving swaps two places; deleting removes the session', async () => {
    const mock = routeFetch({ '/api/sessions': { success: true } })
    const { onChanged } = panel({ sessions: [q1, q2, r1] })
    const rows = screen.getAllByTestId('config-session-row')
    await userEvent.click(within(rows[2]).getByRole('button', { name: 'Move up' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(bodyOf(mock, 'PUT', '/api/sessions/r1')).toEqual({ order: 1 })
    expect(bodyOf(mock, 'PUT', '/api/sessions/q2')).toEqual({ order: 2 })
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2))
    expect(mock).toHaveBeenCalledWith('/api/sessions/q1', { method: 'DELETE' })
  })

  test('an unreachable server is reported', async () => {
    routeFetch({ '/api/sessions': new Error('offline') })
    const { onError } = panel({ sessions: [q1] })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('offline'))
  })

  test('a finished championship adds nothing', () => {
    panel({ championship: finished })
    expect(screen.getByRole('button', { name: 'Qualif' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Race' })).toBeDisabled()
  })
})

describe('ChampionshipParticipantsPanel', () => {
  function panel(props = {}) {
    const handlers = { onChanged: vi.fn(), onError: vi.fn() }
    render(
      <ChampionshipParticipantsPanel championship={auto} sessions={[q1]} drivers={drivers} {...handlers} {...props} />
    )
    return handlers
  }

  test('the participants, numbered; only the others can be added', async () => {
    const mock = routeFetch({ 'PUT /api/championships/c1/participants': { success: true } })
    const { onChanged } = panel()
    expect(screen.getByText('Participants (2)')).toBeInTheDocument()
    const panelEl = screen.getByTestId('championship-config-participants')
    expect(panelEl.querySelector('img')).toHaveAttribute('src', '/uploads/ana.png')
    const add = screen.getByRole('combobox', { name: 'Add a driver...' })
    expect(
      within(add)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Add a driver...', 'Cid'])
    await userEvent.selectOptions(add, 'd3')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(bodyOf(mock, 'PUT').participants).toEqual([{ driverId: 'd1' }, { driverId: 'd2' }, { driverId: 'd3' }])
  })

  test('removing a participant; a refusal is reported', async () => {
    const mock = routeFetch({ 'PUT /api/championships/c1/participants': { success: true } })
    const { onChanged } = panel()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(bodyOf(mock, 'PUT').participants).toEqual([{ driverId: 'd2' }])
    cleanup()
    routeFetch({ 'PUT /api/championships/c1/participants': withStatus(400, { error: 'Running' }) })
    const { onError } = panel()
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Running'))
  })

  test('nobody leaves once a qualifying session has started; nobody joins a finished championship', () => {
    panel({ sessions: [{ ...q1, status: SessionStatus.FINISHED }] })
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    cleanup()
    panel({ championship: { ...auto, status: ChampionshipStatus.FINISHED } })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  test('without participants yet', () => {
    panel({ championship: { ...auto, participants: undefined } })
    expect(screen.getByText('Participants (0)')).toBeInTheDocument()
    expect(within(screen.getByRole('combobox')).getAllByRole('option')).toHaveLength(4)
  })
})

describe('ChampionshipInfoFields', () => {
  function fields(props = {}) {
    const handlers = { onNameChange: vi.fn(), onTrackChange: vi.fn() }
    render(
      <ChampionshipInfoFields
        championship={championship}
        tracks={tracks}
        name="Cup"
        trackId="t1"
        {...handlers}
        {...props}
      />
    )
    return handlers
  }

  test('name and track', async () => {
    const { onNameChange, onTrackChange } = fields()
    await userEvent.type(screen.getByDisplayValue('Cup'), 's')
    expect(onNameChange).toHaveBeenCalledWith('Cups')
    expect(screen.getByRole('combobox')).toHaveTextContent('Monza')
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'Spa' }))
    expect(onTrackChange).toHaveBeenCalledWith('t2')
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: '-- Select --' }))
    expect(onTrackChange).toHaveBeenLastCalledWith('')
  })

  test('a deleted track is still shown; finished, nothing changes', () => {
    fields({
      championship: { ...championship, trackId: 'gone', track: { id: 'gone', name: 'Imola' } },
      trackId: 'gone',
      disabled: true,
    })
    expect(screen.getByRole('combobox')).toHaveTextContent('Imola (deleted)')
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByDisplayValue('Cup')).toBeDisabled()
  })

  test('no track yet', () => {
    fields({ championship: { ...championship, track: tracks[0] }, trackId: '' })
    expect(screen.getByRole('combobox')).toHaveTextContent('-- Select --')
  })
})

describe('ChampionshipConfigFooter', () => {
  const footer = (props = {}) => {
    const handlers = { onReopen: vi.fn(), onClose: vi.fn(), onSave: vi.fn() }
    render(<ChampionshipConfigFooter championship={championship} {...handlers} {...props} />)
    return handlers
  }

  test('a running championship can be finished and saved', async () => {
    const onFinish = vi.fn()
    const { onSave, onClose } = footer({ onFinish })
    await userEvent.click(screen.getByRole('button', { name: 'Finish championship' }))
    expect(onFinish).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('a finished one is reopened, not saved; saving in progress', async () => {
    const { onReopen } = footer({ championship: finished })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Reopen championship' }))
    expect(onReopen).toHaveBeenCalled()
    cleanup()
    footer({ saving: true })
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Finish|Reopen/ })).not.toBeInTheDocument()
  })
})

describe('ChampionshipConfigModal', () => {
  function sheet(props = {}) {
    const handlers = { onClose: vi.fn(), onSave: vi.fn(), onSessionsChange: vi.fn() }
    const view = render(
      <ChampionshipConfigModal
        open
        championship={championship}
        sessions={[q1]}
        tracks={tracks}
        drivers={drivers}
        {...handlers}
        {...props}
      />
    )
    return { ...handlers, view }
  }

  test('a manual championship: its fields and sessions, no participants', () => {
    routeFetch({})
    sheet()
    expect(screen.getByText('Championship Configuration')).toBeInTheDocument()
    expect(screen.getByTestId('championship-config-info')).toBeInTheDocument()
    expect(screen.getByTestId('championship-config-sessions')).toBeInTheDocument()
    expect(screen.queryByTestId('championship-config-participants')).not.toBeInTheDocument()
    cleanup()
    sheet({ championship: auto })
    expect(screen.getByTestId('championship-config-participants')).toBeInTheDocument()
  })

  test('a name is required', async () => {
    const mock = routeFetch({})
    sheet()
    await userEvent.clear(screen.getByDisplayValue('Cup'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
    expect(mock).not.toHaveBeenCalled()
  })

  test('saving hands the championship back, then closes', async () => {
    const saved = { ...championship, name: 'Winter Cup' }
    const mock = routeFetch({ 'PUT /api/championships/c1': { success: true, data: saved } })
    const { onSave, onClose } = sheet()
    await userEvent.type(screen.getByDisplayValue('Cup'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(saved))
    expect(onClose).toHaveBeenCalled()
    expect(bodyOf(mock, 'PUT')).toEqual({ name: 'Cup!', trackId: 't1' })
  })

  test("a refused save shows the server's error", async () => {
    routeFetch({ 'PUT /api/championships/c1': withStatus(409, { error: 'Name taken' }) })
    const { onClose } = sheet()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Name taken')
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a panel error is shown above the sheet', async () => {
    routeFetch({ '/api/sessions': new Error('offline') })
    sheet()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })

  test('finishing closes the sheet', async () => {
    routeFetch({})
    const onFinish = vi.fn()
    const { onClose } = sheet({ onFinish })
    await userEvent.click(screen.getByRole('button', { name: 'Finish championship' }))
    expect(onFinish).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  test('a finished championship is locked until reopened', async () => {
    const reopened = { ...championship }
    routeFetch({ 'PUT /api/championships/c1': { success: true, data: reopened } })
    const { onSave, onClose } = sheet({ championship: finished })
    expect(screen.getByText(/the configuration is locked/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reopen championship' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(reopened))
    expect(onClose).toHaveBeenCalled()
  })

  test('a refused reopening leaves it as is; an unreachable server is reported', async () => {
    routeFetch({ 'PUT /api/championships/c1': 400 })
    const { onSave, onClose } = sheet({ championship: finished })
    await userEvent.click(screen.getByRole('button', { name: 'Reopen championship' }))
    await waitFor(() => expect(onSave).not.toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    routeFetch({ 'PUT /api/championships/c1': new Error('offline') })
    await userEvent.click(screen.getByRole('button', { name: 'Reopen championship' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })

  test('the fields follow the championship when it is reloaded', async () => {
    routeFetch({})
    const { view, onClose } = sheet()
    await userEvent.type(screen.getByDisplayValue('Cup'), '?')
    const props = { sessions: [], tracks, drivers, onClose, onSave: vi.fn() }
    view.rerender(<ChampionshipConfigModal open championship={{ ...championship, name: 'Renamed' }} {...props} />)
    expect(screen.getByDisplayValue('Renamed')).toBeInTheDocument()
    view.rerender(<ChampionshipConfigModal open={false} championship={championship} {...props} />)
    view.rerender(<ChampionshipConfigModal open championship={{ ...championship, trackId: null }} {...props} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('-- Select --')
  })
})
