import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import StandingRow from './standings/StandingRow'
import StandingsTabBar from './standings/StandingsTabBar'
import { gapToLeader, standingsFor } from './standings/standingsOrder'

/**
 * StandingsTabs - Three tabs for Practice, Qualifications and Races standings
 * Practice tab: sorted by best lap time from practice session
 * Qualif tab: sorted by qualifBestTime
 * Race tab: sorted by raceTotalLaps desc, then raceTotalTime asc
 */
export default function StandingsTabs({ standings = {}, drivers = [], activeTab = SessionType.PRACTICE, onTabChange }) {
  const { t } = useTranslation('championships')
  const sorted = useMemo(() => standingsFor(standings, activeTab), [standings, activeTab])
  const driverOf = (standing) =>
    standing.driver ||
    drivers.find((d) => d.id === standing.driverId) || { name: t('standings.unknownDriver'), color: '#6B7280' }

  return (
    // Labels follow the panel's width, not the window's: the panel is a third of the page
    <div className="@container bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <StandingsTabBar activeTab={activeTab} onTabChange={onTabChange} />
      <div>
        {sorted.length === 0 ? (
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
