/**
 * The pauses at `now`: their `total` time, and `current`, the time of the one still open (null
 * when none is). A pause is `{ start, end }` in ms, `end` null while it lasts.
 */
export function pauseDurations(pauses, now) {
  let total = 0;
  let current = null;
  for (const { start, end } of pauses) {
    if (end) {
      total += end - start;
    } else {
      current = now - start;
      total += current;
    }
  }
  return { total, current };
}

/** Racing time at `now`: since `startedAt`, without the `pauseTotal`; 0 before the start. */
export function racingTime(startedAt, pauseTotal, now) {
  if (!startedAt) return 0;
  return now - new Date(startedAt).getTime() - pauseTotal;
}
