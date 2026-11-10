import { useTranslation } from 'react-i18next'
import StandingsTabs from './StandingsTabs'

/** The championship's general standings, beside the session. */
export default function ChampionshipStandingsPanel({ standings, drivers, activeTab, onTabChange }) {
  const { t } = useTranslation('championships')
  return (
    <div data-testid="championship-standings">
      <h2 className="text-sm font-semibold mb-3">{t('detail.generalStandings')}</h2>
      <StandingsTabs standings={standings} drivers={drivers} activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}
