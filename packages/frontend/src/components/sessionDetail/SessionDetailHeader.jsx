import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Clock, Flag, MapPin, Scale, Trophy } from 'lucide-react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/ui/DeleteButton'
import ExportButton from '@/components/ui/ExportButton'

const TYPE_ICONS = { [SessionType.BALANCING]: Scale, [SessionType.RACE]: Flag }

function formatDate(date, locale) {
  return new Date(date).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A stored session's name, type, status, track, championship and date, with back, export and delete. */
export default function SessionDetailHeader({ session, onBack, onDelete }) {
  const { t, i18n } = useTranslation('sessions')
  const TypeIcon = TYPE_ICONS[session.type] || Clock

  return (
    <div className="border-b px-4 py-3 flex items-center justify-between" data-testid="session-detail-header">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <TypeIcon className="size-5 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg">{session.name || t('unnamedSession', { id: session.id.slice(0, 8) })}</h1>
            <Badge variant="outline">
              {t(`glossary:sessionTypeFull.${session.type}`, { defaultValue: session.type })}
            </Badge>
            <Badge variant={session.status === SessionStatus.FINISHED ? 'default' : 'secondary'}>
              {t(`glossary:sessionStatus.${session.status}`, { defaultValue: session.status })}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {session.track && (
              <Link to={`/tracks/${session.track.id}`} className="hover:underline flex items-center gap-1">
                <MapPin className="size-3" />
                {session.track.name}
              </Link>
            )}
            {session.championship && (
              <Link
                to={`/championships/${session.championship.id}`}
                className="hover:underline flex items-center gap-1"
              >
                <Trophy className="size-3" />
                {session.championship.name}
              </Link>
            )}
            <span>· {formatDate(session.createdAt, i18n.language)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ExportButton url={`/api/sessions/${session.id}/export`} />
        <DeleteButton variant="outline" onDelete={onDelete} />
      </div>
    </div>
  )
}
