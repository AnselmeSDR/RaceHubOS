import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import StandingRow from './standings/StandingRow'
import StandingsTabBar from './standings/StandingsTabBar'
import { gapToLeader, standingsFor } from './standings/standingsOrder'

/**
 * StandingsTabs - Three tabs for Practice, Qualifications and Races standings
 * Practice tab: sorted by best lap time over the practice sessions
 * Qualif tab: sorted by qualifBestTime
 * Race tab: sorted by raceTotalLaps desc, then raceTotalTime asc
 * `lineup`: the entries of the session about to run, shown while nobody is ranked
 */
export default function StandingsTabs({
  standings = {},
  drivers = [],
  lineup = [],
  activeTab = SessionType.PRACTICE,
  onTabChange,
}) {
  const { t } = useTranslation('championships')
  const sorted = useMemo(() => standingsFor(standings, activeTab), [standings, activeTab])
  // Nobody ranked yet: the drivers of the grid already stand there, dashes in place of their times
  const waiting = lineup.filter((entry) => entry.driverId)
  const driverOf = (standing) =>
    standing.driver ||
    drivers.find((d) => d.id === standing.driverId) || { name: t('standings.unknownDriver'), color: '#6B7280' }

  return (
    // Labels follow the panel's width, not the window's: the panel is a third of the page
    <div className="@container bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <StandingsTabBar activeTab={activeTab} onTabChange={onTabChange} />
      <div>
        {sorted.length === 0 && waiting.length > 0 ? (
          <div className="divide-y divide-border">
            {waiting.map((entry) => (
              <StandingRow key={entry.driverId} standing={entry} driver={driverOf(entry)} gap={null} tab={activeTab} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t('standings.noStandings')}</div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((standing, index) => (
              <StandingRow
                key={`${activeTab}-${standing.driverId}-${standing.carId || index}`}
                standing={standing}
                driver={driverOf(standing)}
                position={index + 1}
                gap={gapToLeader(standing, sorted[0], activeTab)}
                tab={activeTab}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
