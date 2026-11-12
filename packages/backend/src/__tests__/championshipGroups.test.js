import {
  carTaken,
  dealGroups,
  distributeEvenly,
  distributeSequential,
  groupCount,
  separateCars,
} from '@racehubos/shared';

// Drivers named after their car: "A1" and "A2" share car A, "x" has none
const carOf = (driver) => (driver.startsWith('x') ? null : driver[0]);

test('round-robin and balanced consecutive groups', () => {
  expect(distributeEvenly([0, 1, 2, 3, 4], 2)).toEqual([[0, 3], [1, 4], [2]]);
  expect(distributeSequential([0, 1, 2, 3, 4], 3)).toEqual([
    [0, 1, 2],
    [3, 4],
  ]);
});

test('one group more per driver sharing a car beyond what the size gives, so that they all run apart', () => {
  expect(groupCount(['A1', 'B1', 'A2'], 4, carOf)).toBe(2);
  expect(groupCount(['A1', 'A2', 'A3', 'B1'], 6, carOf)).toBe(3);
  expect(groupCount(['x1', 'x2', 'B1'], 2, carOf)).toBe(2);
  expect(groupCount(['A1', 'A2'], 4)).toBe(1);
  expect(groupCount([], 4, carOf)).toBe(0);
  expect(distributeEvenly(['A1', 'B1', 'A2'], 4, carOf)).toEqual([['A1', 'B1'], ['A2']]);
  expect(distributeSequential(['A1', 'A2', 'B1'], 6, carOf)).toEqual([['A1', 'B1'], ['A2']]);
});

test('dealt into a given number of groups, some maybe empty; none without a group', () => {
  expect(dealGroups(['A1', 'A2', 'B1'], 4, carOf)).toEqual([['A1'], ['A2'], ['B1'], []]);
  expect(dealGroups(['A1', 'B1', 'A2', 'C1'], 2, carOf)).toEqual([
    ['A1', 'B1'],
    ['A2', 'C1'],
  ]);
  expect(dealGroups(['A1'], 0, carOf)).toEqual([]);
});

test('a car is taken when another driver of the group runs it; no car never clashes', () => {
  expect(carTaken(['A1', 'B1'], 'A2', carOf)).toBe(true);
  expect(carTaken(['A1', 'B1'], 'A2', carOf, 'A1')).toBe(false);
  expect(carTaken(['A1', 'A2'], 'A1', carOf)).toBe(true);
  expect(carTaken(['x1', 'B1'], 'x2', carOf)).toBe(false);
});

test('the last of a clash swaps with the nearest group, its nearest driver first', () => {
  expect(
    separateCars(
      [
        ['A1', 'B1', 'A2'],
        ['C1', 'D1'],
        ['E1', 'F1'],
      ],
      carOf
    )
  ).toEqual([
    ['A1', 'B1', 'C1'],
    ['A2', 'D1'],
    ['E1', 'F1'],
  ]);
  // Before the clash, the group's last drivers are the nearest
  expect(
    separateCars(
      [
        ['C1', 'D1'],
        ['A1', 'A2'],
      ],
      carOf
    )
  ).toEqual([
    ['C1', 'A2'],
    ['A1', 'D1'],
  ]);
});

test('a swap never makes another clash, and a clash nobody can take stays', () => {
  // B1 cannot go to the first group (B2 is there), so A2 swaps with C1
  expect(
    separateCars(
      [
        ['A1', 'B2', 'A2'],
        ['B1', 'C1'],
      ],
      carOf
    )
  ).toEqual([
    ['A1', 'B2', 'C1'],
    ['B1', 'A2'],
  ]);
  const stuck = [['A1', 'A2'], ['A3']];
  expect(separateCars(stuck, carOf)).toEqual(stuck);
  expect(stuck).toEqual([['A1', 'A2'], ['A3']]);
});
