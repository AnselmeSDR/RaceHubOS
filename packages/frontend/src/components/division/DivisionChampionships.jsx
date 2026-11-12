import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import ChampionshipStatusBadge from '@/components/championship/ChampionshipStatusBadge'
import { DivisionBadges } from './DivisionBadge'

/** The championships whose filters keep this division, each with its filters and status. */
export default function DivisionChampionships({ division }) {
  const { t } = useTranslation('divisions')
  const championships = division.championships ?? []

  return (
    <section className="rounded-xl border border-border bg-card" data-testid="division-championships">
      <h2 className="flex items-center gap-2 px-4 py-3 border-b border-border font-bold">
        <Trophy className="size-4 text-yellow-500" />
        {t('glossary:championship', { count: 2 })}
        <span className="font-medium text-muted-foreground">{championships.length}</span>
      </h2>
      {championships.length === 0 ? (
        <p className="px-4 py-3 text-sm italic text-muted-foreground">{t('profile.noChampionships')}</p>
      ) : (
        <ul>
          {championships.map((championship) => (
            <li key={championship.id} className="border-t border-border/60 first:border-t-0">
              <Link
                to={`/championships/${championship.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="flex-1 min-w-40">
                  <span className="block font-semibold">{championship.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[championship.track?.name, championship.season].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <DivisionBadges divisions={championship.divisions} className="flex flex-wrap gap-1" />
                <ChampionshipStatusBadge status={championship.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
