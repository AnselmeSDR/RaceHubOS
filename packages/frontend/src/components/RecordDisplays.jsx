import { Trophy, Clock, MapPin, Flag } from 'lucide-react'
import { getImgUrl } from '../utils/image'

const positionStyles = {
  1: { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500', text: 'text-yellow-900', ring: 'ring-yellow-300' },
  2: { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-gray-700', ring: 'ring-gray-200' },
  3: { bg: 'bg-gradient-to-r from-orange-400 to-orange-500', text: 'text-orange-900', ring: 'ring-orange-300' },
}

const sessionTypeLabels = {
  race: { label: 'Course', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  qualif: { label: 'Qualif', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  practice: { label: 'Essais', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

/**
 * RecordItem - Display a single record with driver/car/track info
 * Style inspired by F1/NASCAR standings
 */
export function RecordItem({
  position,
  lapTime,
  driver,
  car,
  track,
  sessionType,
  primaryColor = '#3B82F6',
  showDriverAvatar = true,
  showCarAvatar = true,
  showCar = true,
  onClick,
}) {
  const posStyle = positionStyles[position]
  const isTopThree = position <= 3
  const sessionInfo = sessionTypeLabels[sessionType] || sessionTypeLabels.practice

  return (
    <div
      onClick={onClick}
      className={`
        relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200
        ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : ''}
        ${isTopThree ? 'bg-white dark:bg-gray-800 shadow-md' : 'bg-gray-50 dark:bg-gray-700/50'}
      `}
      style={isTopThree ? {
        borderLeft: `4px solid ${position === 1 ? '#EAB308' : position === 2 ? '#9CA3AF' : '#F97316'}`
      } : undefined}
    >
      {/* Position badge */}
      <div
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg flex-shrink-0 shadow
          ${posStyle ? `${posStyle.bg} ${posStyle.text} ring-2 ${posStyle.ring}` : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}
        `}
      >
        {position === 1 ? (
          <Trophy className="w-5 h-5" />
        ) : (
          position
        )}
      </div>

      {/* Driver & Car avatars */}
      <div className="flex items-center -space-x-2 flex-shrink-0">
        {showDriverAvatar && driver && (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md overflow-hidden ring-2 ring-white dark:ring-gray-700 z-10"
            style={{ backgroundColor: driver.color || primaryColor }}
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
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md overflow-hidden ring-2 ring-white dark:ring-gray-700"
            style={{ backgroundColor: car.color || '#666' }}
          >
            {car.img ? (
              <img src={getImgUrl(car.img)} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs">{car.brand?.charAt(0) || '?'}</span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 dark:text-white truncate">
            {driver?.name || 'Inconnu'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${sessionInfo.color}`}
          >
            {sessionInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {showCar && car && (
            <span className="flex items-center gap-1 truncate">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: car.color || '#666' }}
              />
              {car.brand} {car.model}
            </span>
          )}
          {track && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {track.name}
            </span>
          )}
        </div>
      </div>

      {/* Lap time */}
      <div className="flex-shrink-0 text-right">
        <div
          className="text-xl font-black tabular-nums"
          style={{ color: isTopThree ? (position === 1 ? '#EAB308' : primaryColor) : primaryColor }}
        >
          {(lapTime / 1000).toFixed(3)}s
        </div>
      </div>
    </div>
  )
}

/**
 * RecordsList - List of records with title
 */
export function RecordsList({
  title = 'Top 10 Records',
  records,
  primaryColor = '#3B82F6',
  emptyMessage = 'Aucun record enregistré',
  showDriverAvatar = true,
  showCarAvatar = true,
  showCar = true,
  showTrack = true,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-gray-100 dark:border-gray-700"
        style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, transparent 100%)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Trophy className="w-5 h-5" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
      </div>

      {/* Records */}
      <div className="p-4">
        {records && records.length > 0 ? (
          <div className="space-y-2">
            {records.map((record, index) => (
              <RecordItem
                key={record.id}
                position={index + 1}
                lapTime={record.lapTime}
                driver={record.driver}
                car={record.car}
                track={showTrack ? record.track : null}
                sessionType={record.sessionType}
                primaryColor={primaryColor}
                showDriverAvatar={showDriverAvatar}
                showCarAvatar={showCarAvatar}
                showCar={showCar}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}
