import { SessionType } from '@racehubos/shared';
import {
  bracketGroup,
  distributeEvenly,
  distributeSequential,
  isQualif,
  isRace,
  qualifRanking,
} from '../lib/championships/auto.js';

const range = (n) => Array.from({ length: n }, (_, i) => i);

describe('groups of an auto championship', () => {
  test('qualifyings interleave, as few groups as the size allows', () => {
    expect(distributeEvenly(range(10), 4)).toEqual([
      [0, 3, 6, 9],
      [1, 4, 7],
      [2, 5, 8],
    ]);
    expect(distributeEvenly(range(4), 4)).toEqual([[0, 1, 2, 3]]);
    expect(distributeEvenly([], 4)).toEqual([]);
  });

  test('races keep the order and balance the sizes', () => {
    expect(distributeSequential(range(10), 6)).toEqual([
      [0, 1, 2, 3, 4],
      [5, 6, 7, 8, 9],
    ]);
    expect(distributeSequential(range(7), 3)).toEqual([
      [0, 1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(distributeSequential(range(3), 6)).toEqual([[0, 1, 2]]);
  });
});

describe('the qualifying ranking', () => {
  const entry = (driverId, bestLapTime = null) => ({ driverId, driver: { name: driverId }, bestLapTime });

  test('the best lap of each driver across the sessions, fastest first, no lap last', () => {
    const ranking = qualifRanking([
      { drivers: [entry('ana', 9000), entry('ben'), entry(null, 1000), entry('cy', 8500)] },
      { drivers: [entry('ana', 8000), entry('ben', 9500), entry('cy', 9900)] },
    ]);
    expect(ranking.map((r) => [r.driverId, r.bestTime])).toEqual([
      ['ana', 8000],
      ['cy', 8500],
      ['ben', 9500],
    ]);
    expect(ranking[0].driver).toEqual({ name: 'ana' });
  });

  test('participants who never ran come last, in their order', () => {
    const ranking = qualifRanking(
      [{ drivers: [entry('ana'), entry('ben', 9000)] }],
      [{ driverId: 'ben' }, { driverId: 'zoe' }, { driverId: 'max' }]
    );
    expect(ranking.map((r) => [r.driverId, r.bestTime])).toEqual([
      ['ben', 9000],
      ['ana', Infinity],
      ['zoe', Infinity],
      ['max', Infinity],
    ]);
  });
});

test('bracket groups and session kinds', () => {
  const session = { id: 's', autoGroup: 1, name: 'Quali 2', status: 'draft', drivers: [], type: SessionType.QUALIF };
  expect(bracketGroup('Q')(session)).toEqual({
    sessionId: 's',
    group: 1,
    label: 'Q2',
    name: 'Quali 2',
    status: 'draft',
    drivers: [],
  });
  expect(bracketGroup('R')({ ...session, autoGroup: null }).label).toBe('R1');
  expect([isQualif(session), isRace(session), isRace({ type: SessionType.RACE })]).toEqual([true, false, true]);
});
