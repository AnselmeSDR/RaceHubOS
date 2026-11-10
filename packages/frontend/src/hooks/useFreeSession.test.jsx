import { act, renderHook, waitFor } from '@testing-library/react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import { useFreeSession } from './useFreeSession'

const { context } = vi.hoisted(() => ({ context: {} }))
vi.mock('@/context/SessionContext', () => ({ useSession: () => context }))

const lineUp = [{ id: 'sd1', controller: 1, driverId: 'd1', carId: 'c1', driver: {} }]
const assignments = [{ controller: 1, driverId: 'd1', carId: 'c1' }]
const putBodies = (mock) =>
  mock.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([url, init]) => [url, JSON.parse(init.body)])

let reloadStandings

function freeSession(props = {}) {
  return renderHook((p) => useFreeSession({ trackId: 't1', type: SessionType.PRACTICE, reloadStandings, ...p }), {
    initialProps: props,
  })
}

async function opened(props) {
  const hook = freeSession(props)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  const ok = vi.fn(async () => ({ success: true }))
  Object.assign(context, {
    session: null,
    findOrCreateFreeSession: vi.fn(async () => ({ id: 'found', drivers: [] })),
    createSession: vi.fn(async () => ({ success: true, data: { id: 'new' } })),
    loadSession: vi.fn(async () => {}),
    startSession: ok,
    pauseSession: ok,
    resumeSession: ok,
    stopSession: ok,
    resetSession: ok,
  })
  reloadStandings = vi.fn(async () => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('opening', () => {
  test('the free session of the track and type, loading meanwhile', async () => {
    routeFetch({})
    const { result } = freeSession()
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(context.findOrCreateFreeSession).toHaveBeenCalledWith({ trackId: 't1', type: SessionType.PRACTICE })
    expect(context.loadSession).toHaveBeenCalledWith('found')
  })

  test('nothing until a track is chosen', () => {
    freeSession({ trackId: null })
    expect(context.findOrCreateFreeSession).not.toHaveBeenCalled()
  })

  test('again for another type', async () => {
    routeFetch({})
    const { result, rerender } = await opened()
    rerender({ type: SessionType.RACE })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(context.findOrCreateFreeSession).toHaveBeenLastCalledWith({ trackId: 't1', type: SessionType.RACE })
  })

  test("a session without drivers takes the previous session's line-up", async () => {
    context.session = { id: 'previous', drivers: lineUp }
    const mock = routeFetch({ 'PUT /api/sessions': { success: true } })
    await opened()
    expect(putBodies(mock)).toEqual([['/api/sessions/found/drivers', { drivers: assignments }]])
  })

  test('a session with drivers keeps them', async () => {
    context.session = { id: 'previous', drivers: lineUp }
    context.findOrCreateFreeSession = vi.fn(async () => ({ id: 'found', drivers: [{ controller: 2 }] }))
    const mock = routeFetch({})
    await opened()
    expect(mock).not.toHaveBeenCalled()
  })

  test('nothing loads when no session could be found or made', async () => {
    context.findOrCreateFreeSession = vi.fn(async () => null)
    await opened()
    expect(context.loadSession).not.toHaveBeenCalled()
  })

  test('stops loading when it fails', async () => {
    context.findOrCreateFreeSession = vi.fn(async () => {
      throw new Error('offline')
    })
    await opened()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('a new session', () => {
  test('a draft with the settings and line-up of the current session', async () => {
    context.session = { id: 'cur', maxDuration: 60000, maxLaps: 10, gracePeriod: 5000, drivers: lineUp }
    const mock = routeFetch({ 'PUT /api/sessions': { success: true } })
    const { result } = await opened()
    mock.mockClear()
    context.loadSession.mockClear()
    await act(() => result.current.newSession())
    expect(context.createSession).toHaveBeenCalledWith({
      trackId: 't1',
      type: SessionType.PRACTICE,
      name: 'Free Practice',
      status: SessionStatus.DRAFT,
      maxDuration: 60000,
      maxLaps: 10,
      gracePeriod: 5000,
    })
    expect(putBodies(mock)).toEqual([['/api/sessions/new/drivers', { drivers: assignments }]])
    expect(context.loadSession).toHaveBeenCalledWith('new')
    expect(result.current.loading).toBe(false)
  })

  test('default settings, and nothing more without a line-up', async () => {
    const { result } = await opened()
    context.loadSession.mockClear()
    await act(() => result.current.newSession())
    expect(context.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ maxDuration: null, maxLaps: null, gracePeriod: 30000 })
    )
    expect(context.loadSession).not.toHaveBeenCalled()
  })

  test('none without a track', async () => {
    const { result } = freeSession({ trackId: null })
    await act(() => result.current.newSession())
    expect(context.createSession).not.toHaveBeenCalled()
  })

  test('a failure is logged and ends the loading', async () => {
    context.createSession = vi.fn(async () => {
      throw new Error('offline')
    })
    const { result } = await opened()
    await act(() => result.current.newSession())
    expect(console.error).toHaveBeenCalledWith('Error creating session:', expect.any(Error))
    expect(result.current.loading).toBe(false)
  })
})

describe('controls', () => {
  test.each(['start', 'pause', 'resume'])('%s the open session', async (name) => {
    context.session = { id: 'cur' }
    const { result } = await opened()
    await act(() => result.current[name]())
    expect(context[`${name}Session`]).toHaveBeenCalledWith('cur')
  })

  test('nothing without an open session', async () => {
    const { result } = await opened()
    await act(() => result.current.start())
    await act(() => result.current.stop())
    await act(() => result.current.saveConfig({ name: 'x' }))
    expect(context.startSession).not.toHaveBeenCalled()
    expect(context.stopSession).not.toHaveBeenCalled()
    expect(reloadStandings).not.toHaveBeenCalled()
  })

  test('stopping reloads the standings', async () => {
    context.session = { id: 'cur' }
    const { result } = await opened()
    await act(() => result.current.stop())
    expect(context.stopSession).toHaveBeenCalledWith('cur')
    expect(reloadStandings).toHaveBeenCalledOnce()
  })

  test('resetting reloads the standings when it worked', async () => {
    const { result } = await opened()
    await act(() => result.current.reset('s9'))
    expect(context.resetSession).toHaveBeenCalledWith('s9')
    expect(reloadStandings).toHaveBeenCalledOnce()
    context.resetSession = vi.fn(async () => ({ success: false }))
    await act(() => result.current.reset('s9'))
    expect(reloadStandings).toHaveBeenCalledOnce()
  })

  test('a running session of the chosen type is flagged', async () => {
    context.session = { id: 'cur', type: SessionType.PRACTICE, status: SessionStatus.ACTIVE }
    const { result, rerender } = await opened()
    expect(result.current.running).toBe(true)
    rerender({ type: SessionType.RACE })
    expect(result.current.running).toBe(false)
  })
})

describe('saving the configuration', () => {
  test('the line-up is shared with the other free sessions of the track', async () => {
    context.session = { id: 'cur', status: SessionStatus.DRAFT, drivers: [] }
    const mock = routeFetch({
      '/api/sessions?trackId=t1': { success: true, data: [{ id: 'other', status: SessionStatus.DRAFT }] },
      'PUT /api/sessions': { success: true },
    })
    const { result } = await opened()
    context.loadSession.mockClear()
    await act(() => result.current.saveConfig({ drivers: assignments }))
    expect(putBodies(mock)).toEqual([
      ['/api/sessions/cur/drivers', { drivers: assignments }],
      ['/api/sessions/other/drivers', { drivers: assignments }],
      ['/api/sessions/other/drivers', { drivers: assignments }],
    ])
    expect(context.loadSession).toHaveBeenCalledWith('cur')
  })

  test('settings alone stay with the session', async () => {
    context.session = { id: 'cur', drivers: [] }
    const mock = routeFetch({ 'PUT /api/sessions': { success: true } })
    const { result } = await opened()
    await act(() => result.current.saveConfig({ maxLaps: 5 }))
    expect(mock.mock.calls.map(([url]) => url)).toEqual(['/api/sessions/cur'])
  })

  test('a failure is logged', async () => {
    context.session = { id: 'cur', drivers: [] }
    routeFetch({ 'PUT /api/sessions': new Error('offline') })
    const { result } = await opened()
    context.loadSession.mockClear()
    await act(() => result.current.saveConfig({ maxLaps: 5 }))
    expect(context.loadSession).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('Error saving session config:', expect.any(Error))
  })
})
