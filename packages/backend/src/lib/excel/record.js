import { SessionType } from '@racehubos/shared';

/** A blank record: what a driver or a car achieved over a set of entries. */
export const emptyRecord = () => ({
  sessions: 0,
  races: 0,
  wins: 0,
  podiums: 0,
  dnf: 0,
  laps: 0,
  totalTime: 0,
  bestLap: null,
  positions: [],
});

/** Adds one entry (a `SessionDriver`) of `session` to `record`; finishing positions count in races only. */
export function tallyEntry(record, entry, session) {
  record.sessions += 1;
  record.laps += entry.totalLaps ?? 0;
  record.totalTime += entry.totalTime ?? 0;
  if (entry.isDNF) record.dnf += 1;
  if (session.type === SessionType.RACE) {
    record.races += 1;
    if (entry.finalPos != null) record.positions.push(entry.finalPos);
    if (entry.finalPos === 1) record.wins += 1;
    if (entry.finalPos != null && entry.finalPos <= 3) record.podiums += 1;
  }
  return record;
}

export const averagePosition = (record) =>
  record.positions.length ? record.positions.reduce((a, b) => a + b, 0) / record.positions.length : null;
