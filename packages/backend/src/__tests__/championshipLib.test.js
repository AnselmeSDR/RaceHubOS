import { SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import { trimmedStdDev } from '../lib/championships/awards.js';
import { isComputedSort, listWhere, sortComputed } from '../lib/championships/list.js';
import { bestLapStandings, raceStandings } from '../lib/championships/standings.js';
import { restoreChampionship } from '../lib/softDelete.js';

test('lap time spread without the fastest and slowest tenth (one each at least)', () => {
  expect(trimmedStdDev([100, 1, 10, 10, 10])).toBe(0);
  expect(trimmedStdDev([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1000])).toBeCloseTo(Math.sqrt(8.25));
});

test('the list filter: deleted or not, one or several tracks and statuses', () => {
  expect(listWhere({})).toEqual({ deletedAt: null });
  expect(listWhere({ deleted: 'true', trackId: 't1', status: 'a,b' })).toEqual({
    deletedAt: { not: null },
    trackId: 't1',
    status: { in: ['a', 'b'] },
  });
});

test('computed sorts by track name and session counts, descending unless asked', () => {
  const list = [
    { name: 'A', track: { name: 'Zed' }, sessions: [{ type: SessionType.RACE }] },
    { name: 'B', sessions: [{ type: SessionType.QUALIF }, { type: SessionType.QUALIF }] },
    { name: 'C', track: { name: 'Ring' } },
  ];
  const names = (sorted) => sorted.map((c) => c.name);
  expect(isComputedSort('track')).toBe(true);
  expect(isComputedSort('name')).toBe(false);
  expect(isComputedSort('toString')).toBe(false);
  expect(names(sortComputed(list, 'track', 'asc'))).toEqual(['B', 'C', 'A']);
  expect(names(sortComputed(list, 'qualifs'))).toEqual(['B', 'A', 'C']);
  expect(names(sortComputed(list, 'races', 'asc'))).toEqual(['B', 'C', 'A']);
  expect(names(list)).toEqual(['A', 'B', 'C']);
});

test('standings ignore laps without a time and rank totals per driver or per driver and car', () => {
  expect(bestLapStandings([{ driverId: 'd', carId: 'c', lapTime: NaN }])).toEqual([]);
  const entries = [
    { driverId: 'd1', carId: 'c1', totalLaps: 3, totalTime: 30 },
    { driverId: 'd1', carId: 'c2', totalLaps: 2, totalTime: 15, isDNF: true },
    { driverId: 'd2', carId: 'c1' },
  ];
  expect(raceStandings(entries).map((s) => [s.driverId, s.carId, s.totalLaps])).toEqual([
    ['d1', 'c1', 3],
    ['d1', 'c2', 2],
    ['d2', 'c1', 0],
  ]);
  const perDriver = raceStandings(entries, { perCar: false });
  expect(perDriver[0]).toEqual({
    position: 1,
    driverId: 'd1',
    driver: undefined,
    car: undefined,
    totalLaps: 5,
    totalTime: 45,
    finishedRaces: 1,
  });
  expect(perDriver[0]).not.toHaveProperty('carId');
});

test('restoring a championship that is not deleted leaves what was deleted on purpose', async () => {
  await expect(restoreChampionship(prisma, 'nope')).rejects.toThrow('Championship not found');
  const track = await prisma.track.create({ data: { name: 'Ring' } });
  const championship = await prisma.championship.create({ data: { name: 'R', season: '1', trackId: track.id } });
  const session = await prisma.session.create({
    data: { type: SessionType.RACE, trackId: track.id, championshipId: championship.id, deletedAt: new Date() },
  });
  await restoreChampionship(prisma, championship.id);
  expect((await prisma.session.findUnique({ where: { id: session.id } })).deletedAt).not.toBeNull();
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.championship.delete({ where: { id: championship.id } });
  await prisma.track.delete({ where: { id: track.id } });
});
