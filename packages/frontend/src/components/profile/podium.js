const PODIUM = ['text-yellow-500', 'text-gray-400', 'text-orange-500']

/** The colour of a rank: gold, silver, bronze, then muted. */
export const rankClass = (rank) => PODIUM[rank - 1] ?? 'text-muted-foreground'
