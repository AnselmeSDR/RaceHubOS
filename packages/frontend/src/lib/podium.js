const PODIUM_ROWS = [
  'bg-gradient-to-r from-yellow-500/40 to-transparent border-l-4 border-yellow-400',
  'bg-gradient-to-r from-gray-400/30 to-transparent border-l-4 border-gray-300',
  'bg-gradient-to-r from-orange-500/30 to-transparent border-l-4 border-orange-400',
]
const PODIUM_BADGES = ['bg-yellow-400 text-yellow-950', 'bg-gray-300 text-gray-800', 'bg-orange-400 text-orange-950']

/** The gold, silver or bronze background of a standings row; none off the podium. */
export const podiumRow = (position) => PODIUM_ROWS[position - 1] || ''

/** The gold, silver or bronze position badge; muted off the podium. */
export const podiumBadge = (position) => PODIUM_BADGES[position - 1] || 'text-muted-foreground'

/** A gap in milliseconds as seconds behind: "+1.500". */
export const formatGapSeconds = (ms) => `+${(ms / 1000).toFixed(3)}`
