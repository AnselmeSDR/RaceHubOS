import { useTranslation } from 'react-i18next'
import { DivisionScope } from '@racehubos/shared'
import DivisionBadge from './DivisionBadge'
import DivisionLogo from './DivisionLogo'

/** Logo, name, badge, rank and counts of a division, at the top of its page. */
export default function DivisionIdentity({ division }) {
  const { t } = useTranslation('divisions')
  const category = division.scope === DivisionScope.CAR
  const members = (category ? division.cars : division.drivers)?.length ?? 0
  const championships = division.championships?.length ?? 0

  return (
    <div className="min-w-0 flex items-center gap-3" data-testid="division-identity">
      <DivisionLogo division={division} className="size-11" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-black text-lg">{division.name}</h1>
          <DivisionBadge division={division} large />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
            {t(category ? 'card.order' : 'card.rank', { n: division.order })}
          </span>
        </div>
        <div className="text-xs flex flex-wrap items-center gap-3">
          <span className={`font-medium ${category ? 'text-green-600' : 'text-blue-500'}`}>
            {members} {t(category ? 'glossary:car' : 'glossary:driver', { count: members }).toLowerCase()}
          </span>
          <span className="font-medium text-yellow-600">
            {championships} {t('glossary:championship', { count: championships }).toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  )
}
