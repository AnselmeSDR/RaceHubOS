import { SessionStatus, SessionType } from '@racehubos/shared';
import { cuSettingsOf, FACTORY_SETTINGS } from '../lib/sessions/carSettings.js';
import { pauseDurations, racingTime } from '../lib/sessions/clock.js';
import { allDriversFinished, hasDriverFinished, isDNF, nextStep } from '../lib/sessions/finish.js';

test('a car without settings runs at full speed and brake, with a full tank', () => {
  expect(cuSettingsOf({ maxSpeed: null, brakeForce: undefined, fuelCapacity: 0 })).toEqual({
    speed: 10,
    brake: 10,
    fuel: 1,
  });
  expect(cuSettingsOf(null)).toBe(FACTORY_SETTINGS);
});

test('pauses: the closed ones, plus the open one so far', () => {
  expect(pauseDurations([], 5000)).toEqual({ total: 0, current: null });
  expect(
    pauseDurations(
      [
        { start: 1000, end: 1500 },
        { start: 4000, end: null },
      ],
      5000
    )
  ).toEqual({ total: 1500, current: 1000 });
  expect(racingTime(null, 0, 5000)).toBe(0);
  expect(racingTime(new Date(1000), 500, 5000)).toBe(3500);
});

describe('the end of a session', () => {
  const driver = (totalLaps, lapsAtFinishing = null) => ({ totalLaps, lapsAtFinishing });

  test('over laps, the count; over time, a lap after the flag', () => {
    const finishing = { maxLaps: null, status: SessionStatus.FINISHING };
    expect(hasDriverFinished(driver(5), { maxLaps: 5 })).toBe(true);
    expect(hasDriverFinished(driver(4), { maxLaps: 5 })).toBe(false);
    expect(hasDriverFinished(driver(5, 4), finishing)).toBe(true);
    expect(hasDriverFinished(driver(4, 4), finishing)).toBe(false);
    expect(hasDriverFinished(driver(5, null), finishing)).toBe(false);
    expect(hasDriverFinished(driver(5, 4), { maxLaps: null, status: SessionStatus.ACTIVE })).toBe(false);
  });

  test('home: everyone on track at the flag, those without a lap then left out', () => {
    expect(allDriversFinished([driver(5, 4), driver(0, 0)], null)).toBe(true);
    expect(allDriversFinished([driver(5, 4), driver(3, 3)], null)).toBe(false);
    expect(allDriversFinished([driver(10, 9), driver(9, 8)], 10)).toBe(false);
    expect(allDriversFinished([], 10)).toBe(true);
  });

  test('DNF: on track at the flag without finishing', () => {
    expect(isDNF(3, 3, null)).toBe(true);
    expect(isDNF(4, 3, null)).toBe(false);
    expect(isDNF(9, 8, 10)).toBe(true);
    expect(isDNF(10, 8, 10)).toBe(false);
    expect(isDNF(0, 0, null)).toBe(false);
    expect(isDNF(0, null, 10)).toBe(false);
  });

  test('the next step of a running session', () => {
    const step = (phase, status, maxLaps, drivers) => nextStep({ phase, status, maxLaps, drivers });
    const { RACE, BALANCING } = SessionType;
    const { ACTIVE, FINISHING, PAUSED } = SessionStatus;
    expect(step(RACE, ACTIVE, 5, [driver(5), driver(3)])).toEqual({ action: 'flag', reason: 'leader_finished' });
    expect(step(RACE, ACTIVE, 5, [driver(4)])).toBeNull();
    expect(step(RACE, ACTIVE, null, [driver(40)])).toBeNull();
    expect(step(RACE, PAUSED, 5, [driver(5)])).toBeNull();
    expect(step(BALANCING, ACTIVE, 5, [driver(5), driver(0)])).toEqual({ action: 'finish', reason: 'all_finished' });
    expect(step(BALANCING, ACTIVE, 5, [driver(5), driver(2)])).toBeNull();
    expect(step(BALANCING, ACTIVE, 5, [driver(0)])).toBeNull();
    expect(step(RACE, FINISHING, 5, [driver(5, 5), driver(5, 4)])).toEqual({
      action: 'finish',
      reason: 'all_finished',
    });
    expect(step(RACE, FINISHING, 5, [driver(5, 5), driver(4, 4)])).toBeNull();
  });
});
