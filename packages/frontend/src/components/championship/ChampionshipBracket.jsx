import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { SessionType } from '@racehubos/shared'
import BracketColumn from './bracket/BracketColumn'
import MergedRanking from './bracket/MergedRanking'
import { useBracket } from './bracket/useBracket'

/** An automatic championship's path: qualifying groups, the merged ranking, then the race groups. */
export default function ChampionshipBracket({ championshipId, onSessionSelect }) {
  const { t } = useTranslation('championships')
  const { bracket, loading } = useBracket(championshipId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('bracket.loading')}
      </div>
    )
  }
  if (!bracket) return null

  const { qualifGroups, mergedRanking, raceGroups, allQualifsFinished } = bracket
  return (
    <div className="space-y-4">
      <div data-testid="bracket-counts" className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('bracket.participants', { count: bracket.participants?.length || 0 })}</span>
        <span>&middot;</span>
        <span>{t('bracket.qualifsCount', { count: qualifGroups.length })}</span>
        <span>&middot;</span>
        <span>{t('bracket.racesCount', { count: raceGroups.length })}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
        <BracketColumn
          title={t('bracket.qualifications')}
          titleColor="text-blue-600 dark:text-blue-400"
          groups={qualifGroups}
          type={SessionType.QUALIF}
          onSessionSelect={onSessionSelect}
        />
        <div className="flex flex-col items-center justify-center min-h-[200px] px-2">
          <MergedRanking ranking={mergedRanking} ready={allQualifsFinished} />
        </div>
        <BracketColumn
          title={t('bracket.races')}
          titleColor="text-green-600 dark:text-green-400"
          groups={raceGroups}
          type={SessionType.RACE}
          onSessionSelect={onSessionSelect}
        />
      </div>
    </div>
  )
}
