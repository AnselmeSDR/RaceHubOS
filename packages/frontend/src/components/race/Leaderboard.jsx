import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import LapTime from './LapTime'
import GapDisplay from './GapDisplay'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const getImgUrl = (img) => {
  if (!img) return null
  return img.startsWith('http') ? img : `${API_URL}${img}`
}

/**
 * Leaderboard - Real-time race leaderboard with NASCAR-style driver cards
 */
export default function Leaderboard({ leaderboard = [] }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-500">
        No entries in the leaderboard
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {leaderboard.map((entry, index) => {
          const position = entry.position || index + 1
          const driver = entry.driver || {}
          const car = entry.car || {}
          const fixColor = (c) => {
            if (!c) return '#3B82F6'
            const lower = c?.toLowerCase?.() || ''
            if (['#fff', '#ffffff', 'white'].includes(lower)) return '#3B82F6'
            if (['#3b82f6', 'blue', '#0000ff'].includes(lower)) return '#ffffff'
            return c
          }
          const driverColor = fixColor(driver.color) || fixColor(car.color) || '#3B82F6'
          const key = entry.id || driver.id || `ctrl-${entry.controller}`

          return (
            <motion.div
              key={key}
              layout
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{
                layout: { type: 'spring', stiffness: 200, damping: 30, mass: 1 },
                opacity: { duration: 0.3 }
              }}
              className="flex items-center gap-3 p-3 rounded-lg shadow-md"
              style={{
                background: `linear-gradient(to right, ${driverColor}45, ${driverColor}25 50%, ${driverColor}08 70%, white)`,
                borderLeft: `5px solid ${driverColor}`,
                boxShadow: `0 2px 12px ${driverColor}40`,
              }}
            >
              {/* Position */}
              <div className="w-14 flex-shrink-0 text-center">
                <span className={`text-2xl font-black ${
                  position === 1 ? 'text-yellow-500' :
                  position === 2 ? 'text-gray-400' :
                  position === 3 ? 'text-orange-500' :
                  'text-gray-600'
                }`}>
                  {position}
                </span>
                {/* Position delta arrow */}
                {entry.positionDelta !== 0 && entry.positionDelta !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center justify-center gap-0.5 text-xs font-bold ${
                      entry.positionDelta > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {entry.positionDelta > 0 ? (
                      <ArrowUpIcon className="w-3 h-3" />
                    ) : (
                      <ArrowDownIcon className="w-3 h-3" />
                    )}
                    <span>{Math.abs(entry.positionDelta)}</span>
                  </motion.div>
                )}
              </div>

              {/* Driver Photo */}
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden flex-shrink-0"
                style={{ backgroundColor: driverColor }}
              >
                {driver.img ? (
                  <img
                    src={getImgUrl(driver.img)}
                    alt={driver.name || 'Driver'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(driver.name || 'D').charAt(0)}</span>
                )}
              </div>

              {/* Number - Large NASCAR style */}
              {driver.number && (
                <div className="flex-shrink-0 w-16">
                  <span
                    className="text-5xl font-black italic opacity-20"
                    style={{ color: driverColor }}
                  >
                    {driver.number}
                  </span>
                </div>
              )}

              {/* Name & Car */}
              <div className="flex-1 min-w-0">
                <div className="font-black text-xl text-gray-900 uppercase italic truncate">
                  {(driver.name || 'Unknown').split(' ').pop()}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {car.brand} {car.model || car.name || ''}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 flex-shrink-0">
                {/* Laps */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase">Tours</div>
                  <div className="font-mono font-bold text-lg text-gray-900">
                    {entry.laps ?? entry.lapCount ?? 0}
                  </div>
                </div>

                {/* Best Lap */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase">Meilleur</div>
                  <LapTime time={entry.bestLap} size="md" highlight={entry.hasFastestLap} />
                </div>

                {/* Last Lap */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase">Dernier</div>
                  <LapTime time={entry.lastLap} size="md" />
                </div>

                {/* Gap */}
                <div className="text-center min-w-[80px]">
                  <div className="text-xs text-gray-400 uppercase">Écart</div>
                  <GapDisplay gap={entry.gap} position={position} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
