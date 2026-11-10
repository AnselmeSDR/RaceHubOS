import { SessionType } from '@racehubos/shared';

/** How a session ranks its entries: a race by laps then time, any other session by best lap, none last. */
export function compareEntries(sessionType) {
  if (sessionType === SessionType.RACE) {
    return (a, b) => b.totalLaps - a.totalLaps || a.totalTime - b.totalTime;
  }
  return (a, b) => {
    if (a.bestLapTime === null && b.bestLapTime === null) return 0;
    if (a.bestLapTime === null) return 1;
    if (b.bestLapTime === null) return -1;
    return a.bestLapTime - b.bestLapTime;
  };
}

/**
 * Gap of `entry` to `leader`: in a race, the laps it is down, else the time behind; otherwise
 * the best lap behind, null when either has none.
 */
export function gapTo(leader, entry, sessionType) {
  if (sessionType === SessionType.RACE) {
    const lapsDown = leader.totalLaps - entry.totalLaps;
    return lapsDown > 0 ? lapsDown : entry.totalTime - leader.totalTime;
  }
  return leader.bestLapTime && entry.bestLapTime ? entry.bestLapTime - leader.bestLapTime : null;
}

/** Entries ranked, each with its `position` (from 1) and its `gap` to the leader (null for the leader). */
export function rankEntries(entries, sessionType) {
  if (!entries || entries.length === 0) return entries;
  const sorted = [...entries].sort(compareEntries(sessionType));
  const [leader] = sorted;
  return sorted.map((entry, i) => ({
    ...entry,
    gap: i === 0 ? null : gapTo(leader, entry, sessionType),
    position: i + 1,
  }));
}

/** The best lap among the entries, null before any. */
export function bestLapOf(entries) {
  const times = entries.map((d) => d.bestLapTime).filter((t) => t && t > 0);
  return times.length > 0 ? Math.min(...times) : null;
}
