import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import LapTime from '@/components/race/LapTime'
import { carColor, sessionBadgeClass } from '@/lib/colors'

/** The car's last sessions, with its position and best lap in each. */
export default function CarRecentSessions({ car }) {
  const { t } = useTranslation('cars')
  const color = carColor(car)

  return (
    <Card data-testid="car-recent-sessions">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t('common:recentSessions')}</h3>
        </div>
        {car.sessions?.length > 0 ? (
          <div className="divide-y divide-border">
            {car.sessions.slice(0, 8).map((sd) => (
              <Link
                key={sd.id}
                to={`/sessions/${sd.session?.id || sd.sessionId}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${sessionBadgeClass(sd.session?.type)}`}
                  >
                    {sd.session?.type
                      ? t(`glossary:sessionType.${sd.session.type}`, { defaultValue: sd.session.type })
                      : ''}
                  </Badge>
                  <span className="text-sm text-foreground truncate">
                    {sd.session?.track?.name || t('common:unknownTrack')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {sd.finalPos && (
                    <span className="font-black text-base" style={{ color }}>
                      P{sd.finalPos}
                    </span>
                  )}
                  {sd.bestLapTime && <LapTime time={sd.bestLapTime} size="sm" />}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">{t('common:noSessions')}</div>
        )}
      </CardContent>
    </Card>
  )
}
