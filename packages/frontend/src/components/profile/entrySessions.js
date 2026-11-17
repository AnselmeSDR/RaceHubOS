/** The rows of the recent sessions of a driver or a car, from their `SessionDriver` lines. */
export const entrySessions = (entries = []) =>
  entries.map((entry) => ({
    id: entry.id,
    to: `/sessions/${entry.session?.id || entry.sessionId}`,
    date: entry.session?.startedAt ?? entry.session?.createdAt,
    type: entry.session?.type,
    name: entry.session?.name,
    track: entry.session?.track?.name,
    place: entry.finalPos,
    best: entry.bestLapTime,
  }))
