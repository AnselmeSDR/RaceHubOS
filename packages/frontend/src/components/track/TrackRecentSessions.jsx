import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { sessionBadgeClass } from '@/lib/colors'

/** The last sessions run on the track, with their drivers count and date. */
export default function TrackRecentSessions({ track }) {
  const { t, i18n } = useTranslation('tracks')

  return (
    <Card data-testid="track-recent-sessions">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t('common:recentSessions')}</h3>
        </div>
        {track.sessions?.length > 0 ? (
          <div className="divide-y divide-border">
            {track.sessions.slice(0, 8).map((session) => {
              const typeLabel = session.type
                ? t(`glossary:sessionType.${session.type}`, { defaultValue: session.type })
                : ''
              return (
                <Link
                  key={session.id}
                  to={`/sessions/${session.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${sessionBadgeClass(session.type)}`}>
                      {typeLabel}
                    </Badge>
                    <span className="text-sm text-foreground">{session.name || typeLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {session._count?.drivers || 0} {t('glossary:driver', { count: session._count?.drivers || 0 })}
                    </span>
                    <span>{new Date(session.createdAt).toLocaleDateString(i18n.language)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">{t('common:noSessions')}</div>
        )}
      </CardContent>
    </Card>
  )
}
