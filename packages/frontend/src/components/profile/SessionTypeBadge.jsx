import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { sessionBadgeClass } from '@/lib/colors'

/** The kind of a session, in its colour; a kind the glossary does not know is shown as is. */
export default function SessionTypeBadge({ type }) {
  const { t } = useTranslation('glossary')
  if (!type) return null
  return (
    <Badge variant="secondary" className={`px-1.5 py-0 text-[10px] ${sessionBadgeClass(type)}`}>
      {t(`sessionType.${type}`, { defaultValue: type })}
    </Badge>
  )
}
