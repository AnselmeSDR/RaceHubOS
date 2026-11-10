import { act, cleanup, renderHook } from '@testing-library/react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import { SessionProvider, useSession } from '../SessionContext'
import { announceFinish, bestLapLine, podiumLines, podiumOf } from './announcements'
import * as requests from './sessionRequests'
import {
  EMPTY_TIMING,
  closedPausesSeconds,
  heartbeatTiming,
  leaderboardIn,
  loadedTiming,
  parsePauses,
} from './sessionTiming'
import { useIsStale } from './useIsStale'
import { FORWARDED_EVENTS, SESSION_EVENTS, useSessionSocket } from './useSessionSocket'

const socket = vi.hoisted(() => ({
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))

const app = vi.hoisted(() => ({ setSessionActive: () => {} }))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))
const voice = vi.hoisted(() => ({}))
vi.mock('@/context/VoiceContext', () => ({ useVoice: () => voice }))

const ana = { name: 'Ana' }
const ben = { name: 'Ben' }
const cid = { name: 'Cid' }
const dan = { name: 'Dan' }

function voiceStub({ podium = false, bestLap = true, minLaps = 2 } = {}) {
  return {
    speak: vi.fn(() => ({})),
    formatTimeVoice: (ms) => `${ms} ms`,
    podiumEnabledRef: { current: podium },
    bestLapEnabledRef: { current: bestLap },
    minLapsRef: { current: minLaps },
  }
}

class SilentAudio {
  static played = 0
  play() {
    SilentAudio.played++
    return Promise.resolve()
  }
}

const emit = (event, data) => act(() => socket.handlers[event](data))

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  socket.handlers = {}
  socket.disconnect = vi.fn()
  app.setSessionActive = vi.fn()
  Object.assign(voice, voiceStub())
  SilentAudio.played = 0
  vi.stubGlobal('Audio', SilentAudio)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('timing', () => {
  test('pauses stored as JSON or already read; only the finished ones count', () => {
    const pauses = [{ start: 1000, end: 4500 }, { start: 9000, end: 10000 }, { start: 20000 }]
    expect(parsePauses(JSON.stringify(pauses))).toEqual(pauses)
    expect(parsePauses(pauses)).toBe(pauses)
    expect(parsePauses(null)).toEqual([])
    expect(closedPausesSeconds(pauses)).toBe(4)
  })

  test('a loaded session started: its start and pauses; not started: a clock at zero', () => {
    const running = { ...EMPTY_TIMING, elapsed: 50, remaining: 70, gracePeriodRemaining: 3, pauseDuration: 4 }
    const started = loadedTiming(running, { startedAt: 't0', pauses: '[{"start":0,"end":2000}]' })
    expect(started).toEqual({ ...running, startedAt: 't0', pauses: [{ start: 0, end: 2000 }], totalPauseDuration: 2 })
    expect(loadedTiming(running, {})).toEqual({ ...EMPTY_TIMING, pauseDuration: 4 })
  })

  test("the heartbeat's times in seconds; what it leaves out is kept", () => {
    const timing = { ...EMPTY_TIMING, elapsed: 5, remaining: 60, gracePeriodRemaining: 9, startedAt: 't0' }
    expect(
      heartbeatTiming(timing, {
        elapsedTime: 12999,
        remainingTime: 47001,
        gracePeriodRemaining: 2100,
        pauseDuration: 3500,
        totalPauseDuration: 8200,
        pauses: [{ start: 1 }],
        startedAt: 't1',
      })
    ).toEqual({
      elapsed: 12,
      remaining: 47,
      gracePeriodRemaining: 3,
      pauseDuration: 3,
      totalPauseDuration: 8,
      pauses: [{ start: 1 }],
      startedAt: 't1',
    })
    expect(heartbeatTiming(timing, {})).toEqual({ ...timing, pauseDuration: null, totalPauseDuration: 0, pauses: [] })
    expect(heartbeatTiming(timing, { gracePeriodRemaining: 0 }).gracePeriodRemaining).toBeNull()
  })

  test('a leaderboard sent alone or in an object', () => {
    expect(leaderboardIn([1])).toEqual([1])
    expect(leaderboardIn({ leaderboard: [2] })).toEqual([2])
    expect(leaderboardIn({ leaderboard: 'x' })).toBeNull()
    expect(leaderboardIn(null)).toBeNull()
  })
})

describe('announcements', () => {
  const rows = [
    { driver: ana, totalLaps: 10, totalTime: 300, bestLapTime: 29 },
    { driver: ben, totalLaps: 10, totalTime: 290, bestLapTime: 31 },
    { driver: cid, totalLaps: 11, totalTime: 320, bestLapTime: 30 },
    { driver: dan, totalLaps: 9, totalTime: 0, bestLapTime: 28 },
    { driver: null, totalLaps: 12 },
    { driver: { name: 'Eva' }, totalLaps: 0 },
  ]

  test('a race podium by laps then time; qualifying by best lap; only drivers who drove', () => {
    expect(podiumOf(rows, SessionType.RACE).map((r) => r.driver)).toEqual([cid, ben, ana])
    expect(podiumOf(rows, SessionType.QUALIF).map((r) => r.driver)).toEqual([dan, ana, cid])
    expect(
      podiumOf(
        [
          { driver: ana, bestLapTime: 30 },
          { driver: ben, totalLaps: 1 },
        ],
        SessionType.QUALIF
      )
    ).toEqual([
      { driver: ana, bestLapTime: 30 },
      { driver: ben, totalLaps: 1 },
    ])
    expect(
      podiumOf(
        [
          { driver: ana, totalLaps: 2 },
          { driver: ben, totalLaps: 2, totalTime: 50 },
        ],
        SessionType.RACE
      ).map((r) => r.driver)
    ).toEqual([ben, ana])
  })

  test('third place is announced first, with the time that ranks', () => {
    expect(podiumLines(rows, SessionType.RACE, (ms) => `${ms}`)).toEqual([
      'third, Ana, 300',
      'second, Ben, 290',
      'first, Cid, 320',
    ])
    expect(podiumLines(rows, SessionType.QUALIF, (ms) => `${ms}`)[2]).toBe('first, Dan, 28')
  })

  test('the finish music plays; the podium only when enabled', () => {
    const v = voiceStub()
    announceFinish(v, { leaderboard: rows, sessionType: SessionType.RACE })
    expect(SilentAudio.played).toBe(1)
    vi.useFakeTimers()
    vi.advanceTimersByTime(5000)
    expect(v.speak).not.toHaveBeenCalled()
    announceFinish(voiceStub({ podium: true }), { leaderboard: [], sessionType: SessionType.RACE })
    vi.advanceTimersByTime(5000)
  })

  test('the podium after 3 s, each line when the previous one ends', () => {
    vi.useFakeTimers()
    const v = voiceStub({ podium: true })
    const utterances = []
    v.speak = vi.fn(() => {
      const utterance = {}
      utterances.push(utterance)
      return utterance
    })
    announceFinish(v, { leaderboard: rows, sessionType: SessionType.RACE })
    vi.advanceTimersByTime(2999)
    expect(v.speak).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(v.speak).toHaveBeenCalledWith('third, Ana, 300 ms', { rate: 1.0, force: true })
    utterances[0].onend()
    vi.advanceTimersByTime(500)
    expect(v.speak).toHaveBeenLastCalledWith('second, Ben, 290 ms', { rate: 1.0, force: true })
    utterances[1].onend()
    vi.advanceTimersByTime(500)
    utterances[2].onend()
    vi.advanceTimersByTime(500)
    expect(v.speak).toHaveBeenCalledTimes(3)
  })

  test('without audio or speech, the podium stops quietly', () => {
    vi.stubGlobal(
      'Audio',
      class {
        constructor() {
          throw new Error('no audio')
        }
      }
    )
    vi.useFakeTimers()
    const v = voiceStub({ podium: true })
    v.speak = vi.fn(() => null)
    announceFinish(v, { leaderboard: rows, sessionType: SessionType.RACE })
    vi.advanceTimersByTime(5000)
    expect(v.speak).toHaveBeenCalledTimes(1)
  })

  test('a best lap names the driver, else the car, else the controller', () => {
    const lap = { lapTime: 8123, maxLapsCompleted: 3, controller: 2 }
    expect(bestLapLine(voiceStub(), { ...lap, driverName: 'Ana' })).toBe('Best lap, Ana, 8123 ms')
    expect(bestLapLine(voiceStub(), { ...lap, carBrand: 'Ferrari', carModel: '499P' })).toBe(
      'Best lap, Ferrari 499P, 8123 ms'
    )
    expect(bestLapLine(voiceStub(), lap)).toBe('Best lap, Car 3, 8123 ms')
  })

  test('no best lap announced when disabled or too early', () => {
    const lap = { lapTime: 8123, maxLapsCompleted: 1, controller: 0, driverName: 'Ana' }
    expect(bestLapLine(voiceStub(), lap)).toBeNull()
    expect(bestLapLine(voiceStub({ bestLap: false }), { ...lap, maxLapsCompleted: 5 })).toBeNull()
  })
})

describe('requests', () => {
  test('a session, and its lifecycle actions', async () => {
    const mock = routeFetch({ '/api/sessions/s1': { success: true, data: { id: 's1' } } })
    expect(await requests.getSession('s1')).toEqual({ success: true, data: { id: 's1' } })
    await requests.postSessionAction('s1', 'pause')
    expect(mock).toHaveBeenLastCalledWith('/api/sessions/s1/pause', { method: 'POST' })
  })

  test('the latest free session of a type on a track', async () => {
    const mock = routeFetch({
      '/api/sessions?': {
        success: true,
        data: [
          { id: 'old', createdAt: '2026-01-01' },
          { id: 'new', createdAt: '2026-03-01' },
        ],
      },
    })
    expect(await requests.findFreeSession('t1', SessionType.PRACTICE)).toEqual({ id: 'new', createdAt: '2026-03-01' })
    const url = new URL(mock.mock.calls[0][0], 'http://x')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      trackId: 't1',
      type: SessionType.PRACTICE,
      championshipId: 'null',
    })
    routeFetch({ '/api/sessions?': { success: true, data: [] } })
    expect(await requests.findFreeSession('t1', SessionType.PRACTICE)).toBeNull()
    routeFetch({ '/api/sessions?': { success: false } })
    expect(await requests.findFreeSession('t1', SessionType.PRACTICE)).toBeNull()
  })

  test('a new free session is a draft named in the interface language', async () => {
    const mock = routeFetch({ 'POST /api/sessions': { success: true, data: { id: 's9' } } })
    expect(await requests.createFreeSession('t1', SessionType.QUALIF)).toEqual({ id: 's9' })
    expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({
      trackId: 't1',
      type: SessionType.QUALIF,
      name: 'Qualifying',
      status: SessionStatus.DRAFT,
    })
    routeFetch({ 'POST /api/sessions': { success: false } })
    expect(await requests.createFreeSession('t1', SessionType.QUALIF)).toBeNull()
  })

  test('a session created in its championship, or free', async () => {
    const mock = routeFetch({ 'POST /api': { success: true } })
    await requests.createSession({ championshipId: 'c1', type: SessionType.RACE })
    expect(mock).toHaveBeenLastCalledWith('/api/championships/c1/sessions', expect.anything())
    expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ type: SessionType.RACE })
    await requests.createSession({ type: SessionType.RACE })
    expect(mock).toHaveBeenLastCalledWith('/api/sessions', expect.anything())
  })

  test('a session to load, or the reason it cannot be', async () => {
    routeFetch({ '/api/sessions/s1': { success: true, data: { id: 's1' } } })
    expect(await requests.fetchSessionToLoad('s1')).toEqual({ ok: true, session: { id: 's1' } })
    routeFetch({ '/api/sessions/s1': 404 })
    expect(await requests.fetchSessionToLoad('s1')).toEqual({ ok: false, error: undefined })
    routeFetch({ '/api/sessions/s1': { success: false, error: 'Gone' } })
    expect(await requests.fetchSessionToLoad('s1')).toEqual({ ok: false, error: 'Gone' })
  })

  test('a session that can still run goes to the sync service; its leaderboard is read', async () => {
    const mock = routeFetch({
      'POST /api/sync/load-session/s1': { success: true },
      '/api/sessions/s1/leaderboard': { success: true, data: [{ id: 'e1' }] },
    })
    expect(await requests.prepareSession({ id: 's1', status: SessionStatus.PAUSED })).toEqual([{ id: 'e1' }])
    expect(mock).toHaveBeenCalledWith('/api/sync/load-session/s1', { method: 'POST' })
    mock.mockClear()
    await requests.prepareSession({ id: 's1', status: SessionStatus.FINISHED })
    expect(mock).toHaveBeenCalledTimes(1)
    routeFetch({ '/api/sessions/s1/leaderboard': { success: false } })
    expect(await requests.prepareSession({ id: 's1', status: SessionStatus.FINISHED })).toBeNull()
  })
})

describe('useIsStale', () => {
  test('stale when the last news is more than 2 s old', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ time }) => useIsStale(time), { initialProps: { time: null } })
    act(() => vi.advanceTimersByTime(600))
    expect(result.current).toBe(false)
    rerender({ time: new Date().toISOString() })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(false)
    act(() => vi.advanceTimersByTime(1500))
    expect(result.current).toBe(true)
  })
})

describe('useSessionSocket', () => {
  test('each event goes to its handler; some are forwarded to the window; the socket closes with the app', () => {
    const handlers = { 'session:finished': vi.fn() }
    const forwarded = vi.fn()
    window.addEventListener('session:finished', forwarded)
    const { unmount } = renderHook(() => useSessionSocket(handlers))
    expect(Object.keys(socket.handlers)).toEqual(SESSION_EVENTS)
    emit('session:finished', { sessionId: 's1' })
    expect(handlers['session:finished']).toHaveBeenCalledWith({ sessionId: 's1' })
    expect(forwarded.mock.calls[0][0].detail).toEqual({ sessionId: 's1' })
    // No handler for it: only forwarded
    emit('championship:races_assigned', { championshipId: 'c1' })
    emit('session:heartbeat', {})
    window.removeEventListener('session:finished', forwarded)
    expect(FORWARDED_EVENTS).toContain('championship:races_assigned')
    unmount()
    expect(socket.disconnect).toHaveBeenCalled()
  })
})

describe('SessionProvider', () => {
  const draft = { id: 's1', type: SessionType.RACE, status: SessionStatus.DRAFT, drivers: [{ id: 'd', position: 1 }] }

  function provider() {
    return renderHook(() => useSession(), { wrapper: SessionProvider })
  }

  test('useSession outside a provider fails loudly', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useSession())).toThrow('useSession must be used within a SessionProvider')
  })

  test('the heartbeat sets the clock, the leaderboard and the last news', () => {
    const { result } = provider()
    expect(result.current).toMatchObject({ ...EMPTY_TIMING, leaderboard: [], entries: [], lastServerTime: null })
    const leaderboard = [
      { id: 'e2', position: 2, totalLaps: 5, bestLapTime: 9000 },
      { id: 'e1', position: 1, totalLaps: 6, bestLapTime: 8500, positionDelta: 1 },
    ]
    emit('session:heartbeat', { elapsedTime: 61000, remainingTime: 59000, leaderboard })
    expect(result.current).toMatchObject({ elapsed: 61, remaining: 59, maxLapsCompleted: 6, fastestLap: 8500 })
    expect(result.current.lastServerTime).not.toBeNull()
    expect(result.current.entries.map((e) => [e.id, e.positionDelta, e.hasFastestLap])).toEqual([
      ['e1', 1, true],
      ['e2', 0, false],
    ])
    emit('session:heartbeat', { elapsedTime: 62000 })
    expect(result.current.leaderboard).toBe(leaderboard)
  })

  test('leaderboards and positions as the server sends them', () => {
    const { result } = provider()
    emit('session:leaderboard', [{ id: 'a' }])
    expect(result.current.leaderboard).toEqual([{ id: 'a' }])
    emit('session:leaderboard', { leaderboard: [{ id: 'b' }] })
    expect(result.current.leaderboard).toEqual([{ id: 'b' }])
    emit('session:leaderboard', { nothing: true })
    expect(result.current.leaderboard).toEqual([{ id: 'b' }])
    emit('positions:updated', [{ id: 'c' }])
    expect(result.current.leaderboard).toEqual([{ id: 'c' }])
    emit('positions:updated', 'bad')
    expect(result.current.leaderboard).toEqual([{ id: 'c' }])
  })

  test('the session sent by the server; its drivers until the first lap; only its own status changes', () => {
    const { result } = provider()
    emit('race:session', draft)
    expect(result.current.session).toBe(draft)
    expect(result.current.entries.map((e) => e.id)).toEqual(['d'])
    emit('session:status_changed', { sessionId: 'other', status: SessionStatus.ACTIVE })
    expect(result.current.isActive).toBe(false)
    emit('session:status_changed', { sessionId: 's1', status: SessionStatus.ACTIVE, timestamp: 'ts' })
    expect(result.current).toMatchObject({ isActive: true, lastServerTime: 'ts' })
    expect(app.setSessionActive).toHaveBeenLastCalledWith(true)
    emit('session:status_changed', { timestamp: null })
    emit('session:status_changed', { sessionId: 's1', status: SessionStatus.FINISHING })
    expect(result.current.isFinishing).toBe(true)
  })

  test('a running balancing session leaves the screen as it is', () => {
    provider()
    emit('race:session', { ...draft, type: SessionType.BALANCING, status: SessionStatus.ACTIVE })
    expect(app.setSessionActive).toHaveBeenLastCalledWith(false)
  })

  test('finishing, then finished: final leaderboard, results and podium', () => {
    const { result } = provider()
    emit('race:session', { ...draft, status: SessionStatus.ACTIVE })
    emit('session:finishing', { sessionId: 's1', endsAt: 5, gracePeriodMs: 30000, reason: 'time', extra: 1 })
    expect(result.current.finishingSession).toEqual({
      sessionId: 's1',
      endsAt: 5,
      gracePeriodMs: 30000,
      reason: 'time',
    })
    const final = [{ id: 'f', position: 1, driver: ana, totalLaps: 3 }]
    emit('session:finished', {
      sessionId: 's1',
      championshipId: 'c1',
      reason: 'time',
      sessionType: SessionType.RACE,
      leaderboard: final,
    })
    expect(result.current).toMatchObject({
      isFinished: true,
      finishingSession: null,
      leaderboard: final,
      sessionResults: { sessionId: 's1', championshipId: 'c1', reason: 'time' },
    })
    expect(result.current.session.drivers).toBe(final)
    expect(SilentAudio.played).toBe(1)
    act(() => result.current.clearSessionResults())
    expect(result.current.sessionResults).toBeNull()
  })

  test('a finished session keeps its drivers without a final leaderboard; balancing has no podium', () => {
    const { result } = provider()
    emit('race:session', draft)
    emit('session:finished', { sessionId: 'other', sessionType: SessionType.RACE })
    expect(result.current.session).toBe(draft)
    emit('session:finished', { sessionId: 's1', sessionType: SessionType.BALANCING, leaderboard: [] })
    expect(result.current.session.drivers).toBe(draft.drivers)
    expect(SilentAudio.played).toBe(1)
  })

  test('a best lap is spoken, except in balancing', () => {
    provider()
    const lap = { lapTime: 8000, maxLapsCompleted: 4, controller: 0, driverName: 'Ana' }
    emit('session:bestlap', { ...lap, sessionType: SessionType.BALANCING })
    expect(voice.speak).not.toHaveBeenCalled()
    emit('session:bestlap', { ...lap, maxLapsCompleted: 0 })
    expect(voice.speak).not.toHaveBeenCalled()
    emit('session:bestlap', lap)
    expect(voice.speak).toHaveBeenCalledWith('Best lap, Ana, 8000 ms')
  })

  test('fetching a session', async () => {
    routeFetch({ '/api/sessions/s1': { success: true, data: draft }, '/api/sessions/s2': { success: false } })
    const { result } = provider()
    await act(async () => expect(await result.current.fetchSession('s2')).toBeNull())
    await act(async () => expect(await result.current.fetchSession('s1')).toBe(draft))
    expect(result.current.session).toBe(draft)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ '/api/sessions/s1': new Error('offline') })
    await act(async () => expect(await result.current.fetchSession('s1')).toBeNull())
  })

  test('the free session found, none, or created', async () => {
    const found = { id: 'f1', createdAt: '2026-01-01' }
    routeFetch({ '/api/sessions?': { success: true, data: [found] } })
    const { result } = provider()
    await act(async () =>
      expect(await result.current.findOrCreateFreeSession({ trackId: 't1', type: 'x' })).toBe(found)
    )
    expect(result.current.session).toEqual(found)

    routeFetch({ '/api/sessions?': { success: true, data: [] }, 'POST /api/sessions': { success: false } })
    const none = { trackId: 't1', type: SessionType.PRACTICE, autoCreate: false }
    await act(async () => expect(await result.current.findOrCreateFreeSession(none)).toBeNull())
    expect(result.current.session).toBeNull()
    await act(async () =>
      expect(await result.current.findOrCreateFreeSession({ ...none, autoCreate: true })).toBeNull()
    )

    routeFetch({ '/api/sessions?': { success: true, data: [] }, 'POST /api/sessions': { success: true, data: found } })
    await act(async () =>
      expect(await result.current.findOrCreateFreeSession({ trackId: 't1', type: 'x' })).toEqual(found)
    )
    expect(result.current.session).toEqual(found)

    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ '/api/sessions?': new Error('offline') })
    await act(async () => expect(await result.current.findOrCreateFreeSession({ trackId: 't1', type: 'x' })).toBeNull())
  })

  test("creating a session: the server's answer, the session kept when created", async () => {
    routeFetch({ 'POST /api/sessions': { success: true, data: draft } })
    const { result } = provider()
    await act(async () =>
      expect(await result.current.createSession({ name: 'GP' })).toEqual({ success: true, data: draft })
    )
    expect(result.current.session).toEqual(draft)
    routeFetch({ 'POST /api/sessions': { success: false, error: 'No track' } })
    await act(async () => expect(await result.current.createSession({})).toEqual({ success: false, error: 'No track' }))
    expect(result.current.session).toEqual(draft)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'POST /api/sessions': new Error('offline') })
    await act(async () => expect(await result.current.createSession({})).toEqual({ success: false, error: 'offline' }))
  })

  test('loading a session: its clock, its leaderboard; a switch clears the previous one', async () => {
    const started = { ...draft, status: SessionStatus.ACTIVE, startedAt: 't0', pauses: [{ start: 0, end: 3000 }] }
    routeFetch({
      '/api/sessions/s1': { success: true, data: started },
      '/api/sessions/s1/leaderboard': { success: true, data: [{ id: 'e1', position: 1 }] },
      'POST /api/sync/load-session/s1': { success: true },
      '/api/sessions/s2': { success: true, data: { id: 's2', status: SessionStatus.FINISHED } },
      '/api/sessions/s2/leaderboard': { success: false },
    })
    const { result } = provider()
    expect(await act(() => result.current.loadSession())).toEqual({ success: false, error: 'No session ID' })
    emit('session:finishing', { sessionId: 's1' })
    expect(await act(() => result.current.loadSession('s1'))).toEqual({ success: true, session: started })
    expect(result.current).toMatchObject({
      startedAt: 't0',
      totalPauseDuration: 3,
      leaderboard: [{ id: 'e1', position: 1 }],
    })
    expect(result.current.finishingSession).not.toBeNull()
    emit('session:heartbeat', { elapsedTime: 9000 })
    await act(() => result.current.loadSession('s1'))
    expect(result.current.elapsed).toBe(9)
    await act(() => result.current.loadSession('s2'))
    expect(result.current).toMatchObject({ elapsed: 0, leaderboard: [], startedAt: null, finishingSession: null })
    expect(result.current.session.id).toBe('s2')
  })

  test('a session that cannot be loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ '/api/sessions/s1': { success: false, error: 'Gone' } })
    const { result } = provider()
    expect(await act(() => result.current.loadSession('s1'))).toEqual({ success: false, error: 'Gone' })
    routeFetch({ '/api/sessions/s1': new Error('offline') })
    expect(await act(() => result.current.loadSession('s1'))).toEqual({ success: false, error: 'offline' })
  })

  test('lifecycle actions keep the session the server answers with', async () => {
    const mock = routeFetch({ 'POST /api': { success: true, data: { ...draft, status: SessionStatus.ACTIVE } } })
    const { result } = provider()
    for (const action of ['startSession', 'pauseSession', 'resumeSession', 'stopSession']) {
      await act(() => result.current[action]('s1'))
    }
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      '/api/sessions/s1/start',
      '/api/sessions/s1/pause',
      '/api/sessions/s1/resume',
      '/api/sessions/s1/stop',
    ])
    expect(result.current.isActive).toBe(true)
    routeFetch({ 'POST /api': { success: false, error: 'Busy' } })
    await act(() => result.current.stopSession('s1'))
    expect(result.current.isActive).toBe(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeFetch({ 'POST /api': new Error('offline') })
    expect(await act(() => result.current.startSession('s1'))).toEqual({ success: false, error: 'offline' })
  })

  test('a reset clears the leaderboard, the clock and the results; a refused one changes nothing', async () => {
    routeFetch({ 'POST /api': { success: false } })
    const { result } = provider()
    emit('session:heartbeat', { elapsedTime: 5000, leaderboard: [{ id: 'e' }] })
    emit('session:finished', { sessionId: 'x', sessionType: SessionType.BALANCING })
    await act(() => result.current.resetSession('s1'))
    expect(result.current.elapsed).toBe(5)
    routeFetch({ 'POST /api': { success: true, data: draft } })
    await act(() => result.current.resetSession('s1'))
    expect(result.current).toMatchObject({ session: draft, elapsed: 0, leaderboard: [], sessionResults: null })
  })

  test('clearing forgets the session and its data', () => {
    const { result } = provider()
    emit('race:session', draft)
    emit('session:heartbeat', { elapsedTime: 5000, leaderboard: [{ id: 'e' }] })
    act(() => result.current.clearSession())
    expect(result.current).toMatchObject({ session: null, elapsed: 0, leaderboard: [] })
  })
})
