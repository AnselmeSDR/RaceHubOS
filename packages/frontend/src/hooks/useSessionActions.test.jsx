import { act, renderHook } from '@testing-library/react'
import { SessionStatus } from '@racehubos/shared'
import { routeFetch } from '@/test/helpers'
import { useSessionActions } from './useSessionActions'

const { context } = vi.hoisted(() => ({ context: {} }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => context }))

const session = { id: 's1', status: SessionStatus.DRAFT }
let detail

function actions(selectedSession = session) {
  return renderHook(() => useSessionActions({ ...detail, selectedSession })).result.current
}

/** Runs `fn` on the actions of the selected session, in act. */
async function run(fn) {
  const a = actions()
  await act(() => fn(a))
}

beforeEach(() => {
  const ok = vi.fn(async () => ({ success: true }))
  Object.assign(context, {
    loadSession: ok,
    startSession: ok,
    pauseSession: ok,
    resumeSession: ok,
    stopSession: ok,
    resetSession: ok,
  })
  detail = { selectSession: vi.fn(), reloadSessions: vi.fn(), reloadStandings: vi.fn() }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test.each(['start', 'pause', 'resume'])('%s the selected session, then reload the sessions', async (name) => {
  await run((a) => a[name]())
  expect(context[`${name}Session`]).toHaveBeenCalledWith('s1')
  expect(detail.reloadSessions).toHaveBeenCalledOnce()
  expect(detail.reloadStandings).not.toHaveBeenCalled()
})

test('stopping reloads the standings too', async () => {
  await run((a) => a.stop())
  expect(context.stopSession).toHaveBeenCalledWith('s1')
  expect(detail.reloadSessions).toHaveBeenCalledOnce()
  expect(detail.reloadStandings).toHaveBeenCalledOnce()
})

test('nothing reloads when the context refuses', async () => {
  context.startSession = vi.fn(async () => ({ success: false }))
  context.resetSession = vi.fn(async () => ({ success: false }))
  await run((a) => a.start())
  await run((a) => a.reset('s1'))
  expect(detail.reloadSessions).not.toHaveBeenCalled()
})

test('nothing happens without a selected session', async () => {
  const mock = routeFetch({})
  const none = actions(null)
  await act(() => none.start())
  await act(() => none.saveConfig({ name: 'x' }))
  expect(context.startSession).not.toHaveBeenCalled()
  expect(mock).not.toHaveBeenCalled()
})

test('saving the configuration reloads the sessions and the live session', async () => {
  const mock = routeFetch({ 'PUT /api/sessions/s1': { success: true } })
  await run((a) => a.saveConfig({ name: 'Heat 1' }))
  expect(mock).toHaveBeenCalledWith('/api/sessions/s1', expect.objectContaining({ method: 'PUT' }))
  expect(detail.reloadSessions).toHaveBeenCalledOnce()
  expect(context.loadSession).toHaveBeenCalledWith('s1')
})

test('a failed save reloads nothing', async () => {
  routeFetch({ 'PUT /api/sessions/s1': new Error('offline') })
  await run((a) => a.saveConfig({ name: 'Heat 1' }))
  expect(detail.reloadSessions).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalled()
})

test('deleting the selected session clears the selection', async () => {
  const mock = routeFetch({ 'DELETE /api/sessions': { success: true } })
  await run((a) => a.remove('s1'))
  expect(mock).toHaveBeenCalledWith('/api/sessions/s1', { method: 'DELETE' })
  expect(detail.reloadSessions).toHaveBeenCalledOnce()
  expect(detail.reloadStandings).toHaveBeenCalledOnce()
  expect(detail.selectSession).toHaveBeenCalledWith(null)
})

test('deleting another session keeps the selection', async () => {
  routeFetch({ 'DELETE /api/sessions': { success: true } })
  await run((a) => a.remove('s2'))
  expect(detail.selectSession).not.toHaveBeenCalled()
})

test('a failed deletion changes nothing', async () => {
  routeFetch({ 'DELETE /api/sessions': new Error('offline') })
  await run((a) => a.remove('s1'))
  expect(detail.reloadSessions).not.toHaveBeenCalled()
  expect(detail.selectSession).not.toHaveBeenCalled()
})

test('resetting a session reloads the sessions and the standings', async () => {
  await run((a) => a.reset('s2'))
  expect(context.resetSession).toHaveBeenCalledWith('s2')
  expect(detail.reloadSessions).toHaveBeenCalledOnce()
  expect(detail.reloadStandings).toHaveBeenCalledOnce()
})
