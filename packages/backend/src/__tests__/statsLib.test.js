import { SessionType } from '@racehubos/shared';
import { lapFigures, sessionFilterOf } from '../lib/stats/figures.js';
import { sessionLeaderboard } from '../lib/stats/leaderboards.js';

test('lap figures leave deleted laps out', () => {
  expect(lapFigures([{ lapTime: 10, deletedAt: new Date() }])).toEqual({ bestLap: null, avgLapTime: null });
  expect(lapFigures([{ lapTime: 10 }, { lapTime: 20 }])).toEqual({ bestLap: 10, avgLapTime: 15 });
});

test('a session filter only when something is asked', () => {
  expect(sessionFilterOf({})).toBeNull();
  expect(sessionFilterOf({ championshipId: 'c', trackId: 't' })).toEqual({ championshipId: 'c', trackId: 't' });
  expect(sessionFilterOf({ championshipId: 'c', has_championship: 'true' })).toEqual({ championshipId: { not: null } });
});

test('race order: laps, then best lap, drivers without a lap last; otherwise as placed', () => {
  const entry = (driverId, position, ...times) => ({
    driverId,
    position,
    driver: { name: driverId },
    session: { laps: times.map((lapTime) => ({ driverId, lapTime })) },
  });
  const entries = [entry('a', 3), entry('b', 1, 8000), entry('c', 2), entry('d', 4, 7900)];
  expect(sessionLeaderboard(entries, SessionType.RACE).map((e) => e.driver.name)).toEqual(['d', 'b', 'a', 'c']);
  expect(sessionLeaderboard(entries).map((e) => [e.driver.name, e.position])).toEqual([
    ['a', 3],
    ['b', 1],
    ['c', 2],
    ['d', 4],
  ]);
  const unplaced = sessionLeaderboard([{ ...entry('e'), position: null }]);
  expect(unplaced[0].position).toBeNull();
});
