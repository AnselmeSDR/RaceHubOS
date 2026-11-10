import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import LapTime from '@/components/race/LapTime'

/** The track's lap record and who holds it; nothing while no lap is recorded. */
export default function TrackRecord({ track }) {
  const { t } = useTranslation('tracks')
  if (!track.bestLap) return null

  return (
    <Card data-testid="track-record">
      <CardContent className="p-4 flex items-center gap-4">
        <Trophy className="size-8 text-yellow-500 flex-shrink-0" />
        <div>
          <div className="text-xs text-muted-foreground uppercase font-medium">{t('profile.trackRecord')}</div>
          <LapTime time={track.bestLap} size="xl" highlight />
          {track.bestLapBy && (
            <div className="text-sm text-muted-foreground mt-0.5">
              {t('common:by')} {track.bestLapBy}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
