import { useMemo } from 'react'
import { PlayIcon, ClockIcon, FlagIcon } from '@heroicons/react/24/outline'
import LapTime from '../race/LapTime'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Backend now returns full URLs, but keep helper for backwards compatibility
const getImgUrl = (img) => {
  if (!img) return null
  return img.startsWith('http') ? img : `${API_URL}${img}`
}

/**
 * StandingsTabs - Three tabs for Practice, Qualifications and Races standings
 * Practice tab: sorted by best lap time from practice session
 * Qualif tab: sorted by qualifBestTime
 * Race tab: sorted by raceTotalLaps desc, then raceTotalTime asc
 */
export default function StandingsTabs({
  standings = {},
  drivers = [],
  activeTab = 'practice',
  onTabChange
}) {
  const tabs = [
    { id: 'practice', label: 'Essais Libres', shortLabel: 'Libre', icon: PlayIcon, color: 'purple' },
    { id: 'qualif', label: 'Qualifications', shortLabel: 'Qualif', icon: ClockIcon, color: 'blue' },
    { id: 'race', label: 'Courses', shortLabel: 'Course', icon: FlagIcon, color: 'green' }
  ]

  // Get driver info by ID
  const getDriver = (driverId) => {
    return drivers.find(d => d.id === driverId) || { name: 'Pilote inconnu', color: '#6B7280' }
  }

  // Get sorted standings for current tab
  const sortedStandings = useMemo(() => {
    if (activeTab === 'practice') {
      // Practice standings: array of { driverId, lapTime, driver, car, ... }
      const practiceData = standings.practice || []
      return [...practiceData].sort((a, b) => {
        const aTime = a.lapTime || a.bestTime || Infinity
        const bTime = b.lapTime || b.bestTime || Infinity
        return aTime - bTime
      })
    } else if (activeTab === 'qualif') {
      // Qualif standings from championship standings
      const qualifData = standings.qualif || []
      return [...qualifData]
        .filter(s => s.bestTime !== null && s.bestTime > 0)
        .sort((a, b) => a.bestTime - b.bestTime)
    } else {
      // Race standings from championship standings
      const raceData = standings.race || []
      return [...raceData]
        .filter(s => (s.totalLaps || s.raceTotalLaps) > 0 || s.points > 0)
        .sort((a, b) => {
          const aLaps = a.totalLaps || a.raceTotalLaps || 0
          const bLaps = b.totalLaps || b.raceTotalLaps || 0
          if (bLaps !== aLaps) {
            return bLaps - aLaps
          }
          const aTime = a.totalTime || a.raceTotalTime || Infinity
          const bTime = b.totalTime || b.raceTotalTime || Infinity
          return aTime - bTime
        })
    }
  }, [standings, activeTab])

  // Calculate gap to leader
  const getGap = (standing, index) => {
    if (index === 0) return null
    const leader = sortedStandings[0]

    if (activeTab === 'practice') {
      const leaderTime = leader.lapTime || leader.bestTime
      const currentTime = standing.lapTime || standing.bestTime
      if (leaderTime && currentTime) {
        return { type: 'time', value: currentTime - leaderTime }
      }
    } else if (activeTab === 'qualif') {
      if (leader.bestTime && standing.bestTime) {
        return { type: 'time', value: standing.bestTime - leader.bestTime }
      }
    } else if (activeTab === 'race') {
      const leaderTime = leader.totalTime || leader.raceTotalTime || 0
      const currentTime = standing.totalTime || standing.raceTotalTime || 0
      if (leaderTime && currentTime) {
        return { type: 'time', value: currentTime - leaderTime }
      }
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
      {/* Tabs Header */}
      <div className="flex border-b dark:border-gray-700">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const colorClasses = {
            purple: isActive ? 'text-purple-600 border-purple-600' : 'text-gray-600 dark:text-gray-400 hover:text-purple-600',
            blue: isActive ? 'text-blue-600 border-blue-600' : 'text-gray-600 dark:text-gray-400 hover:text-blue-600',
            green: isActive ? 'text-green-600 border-green-600' : 'text-gray-600 dark:text-gray-400 hover:text-green-600'
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 px-3 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                isActive
                  ? `${colorClasses[tab.color]} border-b-2 bg-gray-50 dark:bg-gray-700`
                  : `${colorClasses[tab.color]} hover:bg-gray-50 dark:hover:bg-gray-700`
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Standings List */}
      <div className="max-h-[400px] overflow-y-auto">
        {sortedStandings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            Aucun classement disponible
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedStandings.map((standing, index) => {
              const driver = standing.driver || getDriver(standing.driverId)
              const gap = getGap(standing, index)
              const position = index + 1

              return (
                <div
                  key={`${activeTab}-${standing.driverId}-${standing.carId || index}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    position === 1 ? 'bg-amber-100 dark:bg-amber-900/40' :
                    position === 2 ? 'bg-slate-100 dark:bg-slate-700/60' :
                    position === 3 ? 'bg-orange-100 dark:bg-orange-900/40' : ''
                  }`}
                >
                  {/* Position */}
                  <span className={`w-6 text-center font-bold text-sm ${
                    position === 1 ? 'text-amber-500' :
                    position === 2 ? 'text-slate-400' :
                    position === 3 ? 'text-amber-700 dark:text-amber-600' :
                    'text-gray-700 dark:text-gray-300'
                  }`}>
                    {position}
                  </span>

                  {/* Driver avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: driver.color || '#6B7280' }}
                  >
                    {driver.img ? (
                      <img
                        src={getImgUrl(driver.img)}
                        alt={driver.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      driver.name?.charAt(0) || '?'
                    )}
                  </div>

                  {/* Driver info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {driver.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      {standing.car && (
                        <span className="truncate">{standing.car.brand} {standing.car.model}</span>
                      )}
                      {(standing.totalLaps || standing.raceTotalLaps || standing.laps) > 0 && (
                        <span>• {standing.totalLaps || standing.raceTotalLaps || standing.laps} tours</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex items-center gap-3">
                    {activeTab === 'practice' && (
                      <>
                        <LapTime time={standing.lapTime || standing.bestTime} size="sm" />
                        {gap !== null && (
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-16 text-right">
                            +{(gap.value / 1000).toFixed(3)}
                          </span>
                        )}
                      </>
                    )}

                    {activeTab === 'qualif' && (
                      <>
                        <LapTime time={standing.bestTime} size="sm" />
                        {gap !== null && (
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-16 text-right">
                            +{(gap.value / 1000).toFixed(3)}
                          </span>
                        )}
                      </>
                    )}

                    {activeTab === 'race' && (
                      <>
                        <LapTime time={standing.totalTime || standing.raceTotalTime} size="sm" />
                        {gap !== null && (
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-16 text-right">
                            +{(gap.value / 1000).toFixed(3)}
                          </span>
                        )}
                        {standing.points !== undefined && (
                          <span className="font-bold text-gray-900 dark:text-white text-sm w-12 text-right">
                            {standing.points} pts
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
