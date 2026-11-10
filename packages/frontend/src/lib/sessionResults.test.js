import { SessionType } from '@racehubos/shared'
import { balancingEntries, fastestLapTime, sessionDuration, sessionEntries } from './sessionResults'

test('the fastest lap among the drivers, null without one', () => {
  expect(fastestLapTime([{ bestLapTime: 8000 }, { bestLapTime: 7000 }, { bestLapTime: 0 }, {}])).toBe(7000)
  expect(fastestLapTime([{}])).toBeNull()
  expect(fastestLapTime()).toBeNull()
})

test('how long a session ran, null until it started and finished', () => {
  expect(sessionDuration({ startedAt: '2026-01-01T10:00:00Z', finishedAt: '2026-01-01T10:05:30Z' })).toBe(330000)
  expect(sessionDuration({ startedAt: '2026-01-01T10:00:00Z' })).toBeNull()
  expect(sessionDuration(null)).toBeNull()
})

describe('sessionEntries', () => {
  test('none without drivers', () => {
    expect(sessionEntries(null)).toEqual([])
    expect(sessionEntries({ drivers: [] })).toEqual([])
  })

  test('a race ranks by laps then total time, the gap in laps or time', () => {
    const entries = sessionEntries({
      type: SessionType.RACE,
      drivers: [
        { id: 'slow', controller: 1, totalLaps: 10, totalTime: 95000, bestLapTime: 9000 },
        { id: 'lapped', controller: 2, totalLaps: 8, totalTime: 80000, bestLapTime: 9500, isDNF: true },
        { id: 'win', controller: 0, totalLaps: 10, totalTime: 90000, bestLapTime: 8800, gridPos: 2 },
        { id: 'none', controller: 3 },
      ],
    })
    expect(entries.map((e) => [e.id, e.position, e.stats.gap])).toEqual([
      ['win', 1, null],
      ['slow', 2, { type: 'time', value: 5000 }],
      ['lapped', 3, { type: 'laps', value: 2 }],
      ['none', 4, { type: 'laps', value: 10 }],
    ])
    expect(entries[0]).toMatchObject({ gridPos: 2, hasFastestLap: true, positionDelta: 0, isDNF: false })
    expect(entries[2].isDNF).toBe(true)
    expect(entries[3]).toMatchObject({
      gridPos: null,
      stats: { laps: 0, bestLap: null, lastLap: null, totalTime: 0 },
    })
  })

  test('a race with equal laps and no time ranks those without time last', () => {
    const entries = sessionEntries({
      type: SessionType.RACE,
      drivers: [
        { id: 'b', totalLaps: 3 },
        { id: 'a', totalLaps: 3, totalTime: 30000 },
      ],
    })
    expect(entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(entries[1].stats.gap).toEqual({ type: 'time', value: -30000 })
  })

  test('other sessions rank by best lap, those without one last and without gap', () => {
    const entries = sessionEntries({
      type: SessionType.QUALIF,
      drivers: [{ id: 'x' }, { id: 'b', bestLapTime: 8200 }, { id: 'y' }, { id: 'a', bestLapTime: 8000 }],
    })
    expect(entries.map((e) => [e.id, e.stats.gap])).toEqual([
      ['a', null],
      ['b', { type: 'time', value: 200 }],
      ['x', null],
      ['y', null],
    ])
  })
})

describe('balancingEntries', () => {
  test('only for a balancing session with laps', () => {
    expect(balancingEntries(null)).toEqual([])
    expect(balancingEntries({ type: SessionType.RACE, laps: [{}] })).toEqual([])
    expect(balancingEntries({ type: SessionType.BALANCING, laps: [] })).toEqual([])
  })

  test("each driver's laps in order, rounded", () => {
    const entries = balancingEntries({
      type: SessionType.BALANCING,
      laps: [
        { controller: 0, lapNumber: 2, lapTime: 8000.4 },
        { controller: 0, lapNumber: 1, lapTime: 8100.6 },
        { controller: 1, lapNumber: 1, lapTime: 9000 },
      ],
      drivers: [
        { id: 'a', controller: 0, driver: 'D', car: 'C', totalLaps: 2, bestLapTime: 8000 },
        { id: 'b', controller: 2 },
      ],
    })
    expect(entries).toEqual([
      {
        id: 'a',
        controller: 0,
        driver: 'D',
        car: 'C',
        laps: [
          { lapNumber: 1, lapTime: 8101 },
          { lapNumber: 2, lapTime: 8000 },
        ],
        stats: { laps: 2, bestLap: 8000 },
      },
      { id: 'b', controller: 2, driver: undefined, car: undefined, laps: [], stats: { laps: 0, bestLap: null } },
    ])
  })

  test('no drivers, no entries', () => {
    expect(balancingEntries({ type: SessionType.BALANCING, laps: [{ controller: 0 }] })).toEqual([])
  })
})
