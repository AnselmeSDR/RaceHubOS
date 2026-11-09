import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Trophy } from 'lucide-react'
import { getData } from '@/lib/sessionApi'
import AwardCard from './results/AwardCard'
import ResultsPodium from './results/ResultsPodium'
import ResultsStandingsTable from './results/ResultsStandingsTable'

/** A championship's results: podium, best moments and final standings, read again when a session finishes. */
export default function ChampionshipResults({ championshipId }) {
  const { t } = useTranslation('championships')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    () =>
      getData(`/api/championships/${championshipId}/results`).then((data) => {
        if (data) setResults(data)
        setLoading(false)
      }),
    [championshipId]
  )

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const refresh = () => reload()
    window.addEventListener('session:finished', refresh)
    return () => window.removeEventListener('session:finished', refresh)
  }, [reload])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('results.loading')}
      </div>
    )
  }

  if (!results || (!results.standings?.length && !results.awards?.length)) {
    return <div className="text-center py-12 text-muted-foreground text-sm">{t('results.noResults')}</div>
  }

  return (
    <div className="space-y-6">
      {results.podium?.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-6" data-testid="championship-results-podium">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 text-center">
            {t('results.podium')}
          </h3>
          <ResultsPodium podium={results.podium} />
        </div>
      )}

      {results.awards?.length > 0 && (
        <div data-testid="championship-results-awards">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
            <Trophy className="size-4 text-championship" />
            {t('results.bestMoments')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.awards.map((award) => (
              <AwardCard key={award.id} award={award} />
            ))}
          </div>
        </div>
      )}

      {results.standings?.length > 0 && (
        <div data-testid="championship-results-standings">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">{t('results.finalStandings')}</h3>
          <ResultsStandingsTable standings={results.standings} />
        </div>
      )}
    </div>
  )
}
