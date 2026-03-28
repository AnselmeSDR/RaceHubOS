import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import LapTime from './LapTime'
import GapDisplay from './GapDisplay'
import { useTheme } from '../../context/ThemeContext'
import { getImgUrl } from '../../utils/image'

/**
 * SessionLeaderboard - Unified leaderboard for all session types
 *
 * @param {Array} entries - Unified format entries
 * @param {string} sortBy - 'laps' | 'bestLap' | 'race'
 * @param {string} sessionType - 'practice' | 'qualif' | 'race'
 */
export default function SessionLeaderboard({
  entries = [],
  sortBy = 'laps',
  sessionType = 'race',
  expanded = false,
}) {
  const { isDark } = useTheme()
  const gradientEnd = isDark ? '#1f2937' : 'white' // gray-800 in dark mode

  // Sort entries based on sortBy prop
  const sortedEntries = [...entries].sort((a, b) => {
    const statsA = a.stats || {}
    const statsB = b.stats || {}

    switch (sortBy) {
      case 'bestLap':
        // Best lap ascending (fastest first), null/0 last
        const bestA = statsA.bestLap || Infinity
        const bestB = statsB.bestLap || Infinity
        return bestA - bestB

      case 'race':
        // Laps descending, then total time ascending
        if ((statsB.laps || 0) !== (statsA.laps || 0)) {
          return (statsB.laps || 0) - (statsA.laps || 0)
        }
        return (statsA.totalTime || Infinity) - (statsB.totalTime || Infinity)

      case 'laps':
      default:
        // Laps descending, then best lap ascending
        if ((statsB.laps || 0) !== (statsA.laps || 0)) {
          return (statsB.laps || 0) - (statsA.laps || 0)
        }
        return (statsA.bestLap || Infinity) - (statsB.bestLap || Infinity)
    }
  })

  // Assign positions and calculate proper gaps for race mode
  const entriesWithPositions = sortedEntries.map((entry, index) => {
    const position = index + 1
    let displayGap = null

    if (sortBy === 'race' && index > 0) {
      const leader = sortedEntries[0]
      const leaderLaps = leader.stats?.laps || 0
      const leaderTime = leader.stats?.totalTime || 0
      const myLaps = entry.stats?.laps || 0
      const myTime = entry.stats?.totalTime || 0

      if (myLaps < leaderLaps) {
        // Different number of laps: show lap difference
        displayGap = { type: 'laps', value: leaderLaps - myLaps }
      } else {
        // Same number of laps: show time difference
        displayGap = { type: 'time', value: myTime - leaderTime }
      }
    }

    return {
      ...entry,
      position,
      displayGap,
      leaderTotalTime: index === 0 && sortBy === 'race' ? entry.stats?.totalTime : null
    }
  })

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-muted rounded-lg p-8 text-center text-muted-foreground">
        No entries in the leaderboard
      </div>
    )
  }

  const fixColor = (c) => {
    if (!c) return '#3B82F6'
    const lower = c?.toLowerCase?.() || ''
    if (['#fff', '#ffffff', 'white'].includes(lower)) return '#3B82F6'
    if (['#3b82f6', 'blue', '#0000ff'].includes(lower)) return '#ffffff'
    return c
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {entriesWithPositions.map((entry) => {
          const position = entry.position
          const driver = entry.driver || {}
          const car = entry.car || {}
          const stats = entry.stats || {}
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
              className={`flex items-center gap-3 rounded-lg shadow-md dark:shadow-none ${expanded ? 'p-4' : 'p-3'}`}
              style={{
                background: `linear-gradient(to right, ${driverColor}45, ${driverColor}25 50%, ${driverColor}08 70%, ${gradientEnd})`,
                borderLeft: `5px solid ${driverColor}`,
                boxShadow: isDark ? 'none' : `0 2px 12px ${driverColor}40`,
              }}
            >
              {/* Position */}
              <div className={`${expanded ? 'w-20' : 'w-16'} flex-shrink-0 flex items-center justify-center gap-1`}>
                <span className={`${expanded ? 'text-3xl' : 'text-2xl'} font-black ${
                  position === 1 ? 'text-yellow-500' :
                  position === 2 ? 'text-gray-400' :
                  position === 3 ? 'text-orange-500' :
                  'text-muted-foreground'
                }`}>
                  {position}
                </span>
                {/* Position delta arrow */}
                {entry.positionDelta !== 0 && entry.positionDelta !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center gap-0.5 text-xs font-bold ${
                      entry.positionDelta > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {entry.positionDelta > 0 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    <span>{Math.abs(entry.positionDelta)}</span>
                  </motion.div>
                )}
              </div>

              {/* Driver Photo */}
              <div
                className={`${expanded ? 'w-16 h-16' : 'w-14 h-14'} rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden flex-shrink-0`}
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

              {/* Number - Large NASCAR style (supports 3 digits) */}
              {driver.number && (
                <div className={`flex-shrink-0 w-20 ${expanded ? 'mr-6' : 'mr-2'}`}>
                  <span
                    className={`font-black italic ${expanded ? (String(driver.number).length >= 3 ? 'text-5xl' : 'text-6xl') : (String(driver.number).length >= 3 ? 'text-4xl' : 'text-5xl')}`}
                    style={{
                      color: driverColor,
                      WebkitTextStroke: isDark && ['#000', '#000000', 'black'].includes(driverColor?.toLowerCase()) ? '2px white' : 'none',
                    }}
                  >
                    {driver.number}
                  </span>
                </div>
              )}

              {/* Car image */}
              {car.img && (
                <div className="w-14 h-10 rounded flex-shrink-0 overflow-hidden shadow-md">
                  <img
                    src={getImgUrl(car.img)}
                    alt={`${car.brand} ${car.model}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Name & Car */}
              <div className="flex-1 min-w-0">
                <div className={`font-black ${expanded ? 'text-2xl' : 'text-xl'} text-foreground uppercase italic truncate`}>
                  {(driver.name || 'Unknown').split(' ').pop()}
                </div>
                <div className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                  {car.color && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-border"
                      style={{ backgroundColor: car.color }}
                    />
                  )}
                  {car.brand} {car.model || car.name || ''}
                </div>
              </div>

              {/* Stats */}
              <div className={`flex items-center ${expanded ? 'gap-8' : 'gap-6'} flex-shrink-0`}>
                {/* Laps */}
                <div className="text-center">
                  <div className={`${expanded ? 'text-sm' : 'text-xs'} text-muted-foreground/50 uppercase`}>Tours</div>
                  <div className={`font-mono font-bold ${expanded ? 'text-2xl' : 'text-lg'} text-foreground`}>
                    {stats.laps ?? 0}
                  </div>
                </div>

                {/* Best Lap */}
                <div className="text-center">
                  <div className={`${expanded ? 'text-sm' : 'text-xs'} text-muted-foreground/50 uppercase`}>Meilleur</div>
                  <LapTime time={stats.bestLap} size={expanded ? 'xl' : 'md'} highlight={entry.hasFastestLap} />
                </div>

                {/* Last Lap */}
                <div className="text-center">
                  <div className={`${expanded ? 'text-sm' : 'text-xs'} text-muted-foreground/50 uppercase`}>Dernier</div>
                  <LapTime time={stats.lastLap} size={expanded ? 'xl' : 'md'} />
                </div>

                {/* Gap / Total Time */}
                <div className={`text-center ${expanded ? 'min-w-[100px]' : 'min-w-[80px]'}`}>
                  <div className={`${expanded ? 'text-sm' : 'text-xs'} text-muted-foreground/50 uppercase`}>
                    {position === 1 && sortBy === 'race' ? 'Total' : 'Écart'}
                  </div>
                  <GapDisplay
                    gap={entry.displayGap || stats.gap}
                    position={position}
                    leaderTotalTime={entry.leaderTotalTime}
                    isRace={sortBy === 'race'}
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
