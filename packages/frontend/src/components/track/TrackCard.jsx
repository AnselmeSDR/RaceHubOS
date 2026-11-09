import { useTranslation } from 'react-i18next'
import { MapPin, RefreshCw, Rocket, Clock, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CardActions from '@/components/crud/CardActions'
import { trackColor } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'

/** A track in the grid of the tracks page: picture, length, corners, record and races count. */
export default function TrackCard({ track, onClick, onEdit, onDelete }) {
  const { t } = useTranslation('tracks')
  const color = trackColor(track)

  return (
    <Card
      data-testid="entity-card"
      data-entity-id={track.id}
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)` }}
    >
      <CardActions onEdit={onEdit} onDelete={onDelete} />
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: color }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: color }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` }}
            >
              {track.img ? (
                <img src={getImgUrl(track.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <MapPin className="w-10 h-10 drop-shadow-lg" />
              )}
            </div>
          </div>
          {track.bestLap && (
            <Badge className="bg-yellow-500 text-white shadow-md">
              <Trophy className="w-3 h-3" />
              {t('common:record')}
            </Badge>
          )}
        </div>
        <h3 className="font-black text-xl tracking-tight text-foreground uppercase">{track.name}</h3>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: color }} />
      </div>

      <div className="relative px-6 pb-6 space-y-3">
        {track.length && (
          <div className="flex items-center justify-between p-2 bg-card/60 rounded-lg">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4" style={{ color: color }} />
              <span className="text-xs font-medium text-muted-foreground uppercase">{t('fields.length')}</span>
            </div>
            <span className="text-sm font-black" style={{ color: color }}>
              {track.length}m
            </span>
          </div>
        )}
        {track.corners && (
          <div className="flex items-center justify-between p-2 bg-card/60 rounded-lg">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" style={{ color: color }} />
              <span className="text-xs font-medium text-muted-foreground uppercase">{t('fields.corners')}</span>
            </div>
            <span className="text-sm font-black" style={{ color: color }}>
              {track.corners}
            </span>
          </div>
        )}
        {track.bestLap && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-bold text-yellow-900 dark:text-yellow-300 uppercase">
                  {t('common:record')}
                </span>
              </div>
              <span className="text-lg font-black text-yellow-600 dark:text-yellow-400">
                {(track.bestLap / 1000).toFixed(3)}s
              </span>
            </div>
            {track.bestLapBy && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 text-right">
                {t('common:by')} {track.bestLapBy}
              </div>
            )}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">{t('glossary:race', { count: 2 })}</span>
            <span className="text-lg font-black" style={{ color: color }}>
              {track._count?.sessions || 0}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
