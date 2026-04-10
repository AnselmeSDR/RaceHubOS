import { Trophy, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import LapTime from './race/LapTime'
import { getImgUrl } from '../utils/image'

const sessionTypeLabels = {
  race: { label: 'Course', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  qualif: { label: 'Qualif', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  practice: { label: 'Essais', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  balancing: { label: 'Équilibrage', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
}

export function RecordItem({
  position,
  lapTime,
  driver,
  car,
  track,
  sessionType,
  showDriverAvatar = true,
  showCarAvatar = true,
  showCar = true,
  onClick,
}) {
  const isTopThree = position <= 3
  const sessionInfo = sessionTypeLabels[sessionType] || sessionTypeLabels.practice

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } hover:bg-muted ${
        position === 1 ? 'bg-gradient-to-r from-yellow-500/15 to-transparent border-l-4 border-yellow-400' :
        position === 2 ? 'bg-gradient-to-r from-gray-400/10 to-transparent border-l-4 border-gray-300' :
        position === 3 ? 'bg-gradient-to-r from-orange-500/10 to-transparent border-l-4 border-orange-400' : ''
      }`}
    >
      {/* Position */}
      <span className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm flex-shrink-0 ${
        position === 1 ? 'bg-yellow-400 text-yellow-950' :
        position === 2 ? 'bg-gray-300 text-gray-800' :
        position === 3 ? 'bg-orange-400 text-orange-950' :
        'text-muted-foreground'
      }`}>
        {position === 1 ? <Trophy className="size-3.5" /> : position}
      </span>

      {/* Avatars */}
      <div className="flex items-center -space-x-2 flex-shrink-0">
        {showDriverAvatar && driver && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-card z-10"
            style={{ backgroundColor: driver.color || '#6B7280' }}
          >
            {driver.img ? (
              <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
            ) : (
              <span>{driver.name?.charAt(0) || '?'}</span>
            )}
          </div>
        )}
        {showCarAvatar && car && (
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-card"
            style={{ backgroundColor: car.color || '#6B7280' }}
          >
            {car.img ? (
              <img src={getImgUrl(car.img)} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
            ) : (
              <span>{car.brand?.charAt(0) || '?'}</span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground truncate">
            {driver?.name || 'Inconnu'}
          </span>
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${sessionInfo.color}`}>
            {sessionInfo.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {showCar && car && (
            <span className="flex items-center gap-1 truncate">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: car.color || '#6B7280' }} />
              {car.brand} {car.model}
            </span>
          )}
          {track && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="size-3 flex-shrink-0" />
              {track.name}
            </span>
          )}
        </div>
      </div>

      {/* Lap time */}
      <div className="flex-shrink-0">
        <LapTime time={lapTime} size={isTopThree ? 'lg' : 'md'} highlight={position === 1} />
      </div>
    </div>
  )
}

export function RecordsList({
  title = 'Top 10 Records',
  records,
  emptyMessage = 'Aucun record enregistré',
  showDriverAvatar = true,
  showCarAvatar = true,
  showCar = true,
  showTrack = true,
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {records && records.length > 0 ? (
          <div className="p-2 space-y-0.5">
            {records.map((record, index) => (
              <RecordItem
                key={record.id}
                position={index + 1}
                lapTime={record.lapTime}
                driver={record.driver}
                car={record.car}
                track={showTrack ? record.track : null}
                sessionType={record.sessionType}
                showDriverAvatar={showDriverAvatar}
                showCarAvatar={showCarAvatar}
                showCar={showCar}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="size-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
