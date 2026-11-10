import { useTranslation } from 'react-i18next'
import { ChampionshipStatus } from '@racehubos/shared'
import { Badge } from '@/components/ui/badge'

const STYLES = {
  [ChampionshipStatus.ACTIVE]: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  [ChampionshipStatus.FINISHED]: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  [ChampionshipStatus.PLANNED]: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
}

/** A championship's status in words; without one it is planned. */
export default function ChampionshipStatusBadge({ status }) {
  const { t } = useTranslation('glossary')
  const key = status || ChampionshipStatus.PLANNED
  return <Badge className={STYLES[key] || STYLES[ChampionshipStatus.PLANNED]}>{t(`championshipStatus.${key}`)}</Badge>
}
