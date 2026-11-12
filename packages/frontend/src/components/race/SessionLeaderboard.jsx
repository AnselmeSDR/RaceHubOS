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

  // Container: the rows tighten as the board narrows; below 40rem they drop the number and car, below 35rem the
  // car picture, below 32rem the driver's, and below 29rem the board scrolls sideways rather than push the times
  // off screen. The scroll box reaches 0.75rem past the
  // board so the rows' shadows are not cut; flow-root keeps its negative margins from eating the page's spacing.
  // One grid for all rows (each row a subgrid): every column takes its widest value, so they all line up:
  // position, name, photo, car, number and car (the rest of the width), then laps, best, last and gap.
  return (
    <div className="flow-root">
      <div className="@container overflow-x-auto -m-3 p-3">
        <div className="relative grid grid-cols-[repeat(4,auto)_minmax(0,1fr)_repeat(4,auto)] gap-y-2 gap-x-1.5 @3xl:gap-x-2 @5xl:gap-x-4 @6xl:gap-x-6 min-w-[29rem]">
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
      </div>
    </div>
  )
}
