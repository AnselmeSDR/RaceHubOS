import { SessionStatus, SessionType } from '@racehubos/shared'
import { isLiveStatus, leaderboardSortBy, toLeaderboardEntries } from './leaderboardEntries'

test('a session is live while active, paused or finishing', () => {
  expect([SessionStatus.ACTIVE, SessionStatus.PAUSED, SessionStatus.FINISHING].every(isLiveStatus)).toBe(true)
  expect([SessionStatus.DRAFT, SessionStatus.READY, SessionStatus.FINISHED, undefined].some(isLiveStatus)).toBe(false)
})

test('practice sorts as chosen, qualifying by best lap, a race in race order', () => {
  expect(leaderboardSortBy(SessionType.PRACTICE, 'laps')).toBe('laps')
  expect(leaderboardSortBy(SessionType.PRACTICE, 'bestLap')).toBe('bestLap')
  expect(leaderboardSortBy(SessionType.QUALIF, 'laps')).toBe('bestLap')
  expect(leaderboardSortBy(SessionType.RACE, 'laps')).toBe('race')
})

describe('toLeaderboardEntries', () => {
  test('no entries without a leaderboard', () => {
    expect(toLeaderboardEntries(null)).toEqual([])
    expect(toLeaderboardEntries([])).toEqual([])
  })

  test('the stored rows as live entries, sorted by position with the unplaced last', () => {
    const entries = toLeaderboardEntries([
      { id: 'c', controller: 3, position: 0, bestLapTime: 0 },
      {
        id: 'b',
        controller: 2,
        driver: { name: 'Ben' },
        car: { model: 'X' },
        gridPos: 1,
        position: 2,
        totalLaps: 10,
        bestLapTime: 8000,
        lastLapTime: 8100,
        totalTime: 90000,
        gap: 1200,
        isDNF: true,
        laps: [{ lapTime: 8000 }],
      },
      { id: 'a', controller: 1, position: 1, totalLaps: 11, bestLapTime: 7900 },
    ])
    expect(entries.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(entries[1]).toEqual({
      id: 'b',
      controller: 2,
      driver: { name: 'Ben' },
      car: { model: 'X' },
      gridPos: 1,
      stats: { laps: 10, bestLap: 8000, lastLap: 8100, totalTime: 90000, gap: 1200 },
      position: 2,
      positionDelta: 0,
      hasFastestLap: false,
      isDNF: true,
      laps: [{ lapTime: 8000 }],
    })
    expect(entries[0].hasFastestLap).toBe(true)
    expect(entries[2]).toMatchObject({
      gridPos: null,
      stats: { laps: 0, bestLap: null, lastLap: null, totalTime: 0, gap: null },
      position: 0,
      isDNF: false,
      laps: [],
    })
  })

  test('nobody has the fastest lap when no lap was timed', () => {
    const [entry] = toLeaderboardEntries([{ id: 'a', position: 1 }])
    expect(entry.hasFastestLap).toBeFalsy()
  })
})
