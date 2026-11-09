import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import LeaderboardRow from './leaderboard/LeaderboardRow'
import { sortEntries, withPositions } from './leaderboard/leaderboardOrder'

/**
 * SessionLeaderboard - Unified leaderboard for all session types
 *
 * @param {Array} entries - Unified format entries
 * @param {string} sortBy - 'laps' | 'bestLap' | 'race'
 * The boards also pass `sessionType`, unused here, for the overrides that need it.
 */
export default function SessionLeaderboard({ entries = [], sortBy = 'laps', sessionStatus, expanded = false }) {
  const { t } = useTranslation('race')

  if (!entries || entries.length === 0) {
    return <div className="bg-muted rounded-lg p-8 text-center text-muted-foreground">{t('leaderboard.empty')}</div>
  }

  // Container: below @4xl (896px) the row tightens so the car name stays readable
  return (
    <div className="@container space-y-2">
      <AnimatePresence mode="popLayout">
        {withPositions(sortEntries(entries, sortBy), sortBy).map((entry) => (
          <LeaderboardRow
            key={entry.id || entry.driver?.id || `ctrl-${entry.controller}`}
            entry={entry}
            sortBy={sortBy}
            sessionStatus={sessionStatus}
            expanded={expanded}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
