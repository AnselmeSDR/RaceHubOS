import { useTranslation } from 'react-i18next'
import StandingsTabs from '@/components/championship/StandingsTabs'

/**
 * The track's overall free-session standings, beside the session; its tabs are the session types.
 * `lineup`: the session's entries, shown while nobody is ranked.
 */
export default function FreeSessionStandingsPanel({ standings, drivers, lineup, activeTab, onTabChange }) {
  const { t } = useTranslation('freeSession')
  return (
    <div data-testid="free-session-standings">
      <h2 className="text-sm font-semibold mb-3">{t('standings.title')}</h2>
      <StandingsTabs
        standings={standings}
        drivers={drivers}
        lineup={lineup}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    </div>
  )
}
