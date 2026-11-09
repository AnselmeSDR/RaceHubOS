import { SessionStatus, SessionType } from '@racehubos/shared';

/** The drivers on track at the flag: those who had done a lap when it was waved. */
const raced = (driver) => driver.lapsAtFinishing != null && driver.lapsAtFinishing > 0;

/**
 * Whether a driver has met their own finish: in a race over laps, the lap count reached; over
 * time, one more lap completed after the flag.
 */
export function hasDriverFinished(driver, { maxLaps, status }) {
  if (maxLaps) return driver.totalLaps >= maxLaps;
  return (
    status === SessionStatus.FINISHING && driver.lapsAtFinishing != null && driver.totalLaps > driver.lapsAtFinishing
  );
}

/** Whether everyone who raced at the flag is home: the lap count over laps, their lap over time. */
export function allDriversFinished(drivers, maxLaps) {
  const racing = drivers.filter(raced);
  if (maxLaps) return racing.every((d) => d.totalLaps >= maxLaps);
  return racing.every((d) => d.totalLaps > d.lapsAtFinishing);
}

/**
 * Whether a driver on track at the flag (`lapsAtFinishing` laps then) did not finish: short of
 * the lap count over laps, no lap since the flag over time.
 */
export function isDNF(totalLaps, lapsAtFinishing, maxLaps) {
  if (lapsAtFinishing === null || !(lapsAtFinishing > 0)) return false;
  return maxLaps ? totalLaps < maxLaps : totalLaps === lapsAtFinishing;
}

/**
 * What a running session must do after a lap: `finish` (balancing with everyone at the count,
 * or everyone home after the flag), `flag` (a race whose leader reached the count), or null.
 */
export function nextStep({ phase, status, maxLaps, drivers }) {
  if (status === SessionStatus.FINISHING) {
    return allDriversFinished(drivers, maxLaps) ? { action: 'finish', reason: 'all_finished' } : null;
  }
  if (status !== SessionStatus.ACTIVE || !maxLaps) return null;
  if (phase === SessionType.BALANCING) {
    const running = drivers.filter((d) => d.totalLaps > 0);
    const done = running.length > 0 && running.every((d) => d.totalLaps >= maxLaps);
    return done ? { action: 'finish', reason: 'all_finished' } : null;
  }
  return drivers.some((d) => d.totalLaps >= maxLaps) ? { action: 'flag', reason: 'leader_finished' } : null;
}
