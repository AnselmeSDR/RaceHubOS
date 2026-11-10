import { avg60Of, balancingFigures, medianOf, raceTotals } from '../lib/records/trackBests.js';

describe('track best figures', () => {
  test('median of an odd, even or empty list', () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([])).toBeNull();
  });

  test('average of the best 60%, from three laps kept', () => {
    expect(avg60Of([10, 20, 30, 40, 50])).toBe(20);
    expect(avg60Of([10, 20, 30, 40])).toBe(20);
    expect(avg60Of([10, 20, 30])).toBeNull();
  });

  test("a pairing's longest entry wins; without times the first one met stays", () => {
    const totals = raceTotals([
      { driverId: 'a', carId: 'x', totalTime: 0, totalLaps: 1 },
      { driverId: 'a', carId: 'x', totalTime: 0, totalLaps: 2 },
      { driverId: 'b', carId: 'x', totalTime: 500, totalLaps: 5 },
      { driverId: 'b', carId: 'x', totalTime: 400, totalLaps: 4 },
      { driverId: null, carId: 'x', totalTime: 100, totalLaps: 1 },
    ]);
    expect(Object.fromEntries(totals)).toEqual({
      'a-x': { totalTime: 0, totalLaps: 1 },
      'b-x': { totalTime: 500, totalLaps: 5 },
      'null-x': { totalTime: 100, totalLaps: 1 },
    });
  });

  test('balancing figures per car, the history in the given session order', () => {
    const lap = (carId, sessionId, lapTime) => ({ carId, sessionId, lapTime });
    const figures = balancingFigures(
      [lap('gt', 's2', 10), lap('gt', 's1', 30), lap('gt', 's2', 20), lap('gt', 's1', 40), lap('gt', 's1', 50)],
      ['s1', 's2', 's3']
    );
    expect(figures.get('gt')).toEqual({
      median: 30,
      avg60: 20,
      history: [
        { median: 40, avg60: null, laps: 3 },
        { median: 15, avg60: null, laps: 2 },
      ],
    });
  });
});
