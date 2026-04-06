import { useMemo } from 'react'
import { Play, Clock, Flag } from 'lucide-react'
import LapTime from '../race/LapTime'
import { getImgUrl } from '../../utils/image'

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
    { id: 'practice', label: 'Essais Libres', shortLabel: 'Libre', icon: Play, color: 'purple' },
    { id: 'qualif', label: 'Qualifications', shortLabel: 'Qualif', icon: Clock, color: 'blue' },
    { id: 'race', label: 'Courses', shortLabel: 'Course', icon: Flag, color: 'green' }
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
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      {/* Tabs Header */}
      <div className="flex border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const colorClasses = {
            purple: isActive ? 'text-purple-600 border-purple-600' : 'text-muted-foreground hover:text-purple-600',
            blue: isActive ? 'text-blue-600 border-blue-600' : 'text-muted-foreground hover:text-blue-600',
            green: isActive ? 'text-green-600 border-green-600' : 'text-muted-foreground hover:text-green-600'
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 px-3 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                isActive
                  ? `${colorClasses[tab.color]} border-b-2 bg-muted/50`
                  : `${colorClasses[tab.color]} hover:bg-muted`
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
      <div>
        {sortedStandings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Aucun classement disponible
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedStandings.map((standing, index) => {
              const driver = standing.driver || getDriver(standing.driverId)
              const gap = getGap(standing, index)
              const position = index + 1

              return (
                <div
                  key={`${activeTab}-${standing.driverId}-${standing.carId || index}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-muted ${
                    position === 1 ? 'bg-gradient-to-r from-yellow-500/40 to-transparent border-l-4 border-yellow-400' :
                    position === 2 ? 'bg-gradient-to-r from-gray-400/30 to-transparent border-l-4 border-gray-300' :
                    position === 3 ? 'bg-gradient-to-r from-orange-500/30 to-transparent border-l-4 border-orange-400' : ''
                  }`}
                >
                  {/* Position */}
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm ${
                    position === 1 ? 'bg-yellow-400 text-yellow-950' :
                    position === 2 ? 'bg-gray-300 text-gray-800' :
                    position === 3 ? 'bg-orange-400 text-orange-950' :
                    'text-muted-foreground'
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
                    <div className="font-medium text-foreground text-sm truncate">
                      {driver.name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
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
                          <span className="font-mono text-xs text-muted-foreground w-16 text-right">
                            +{(gap.value / 1000).toFixed(3)}
                          </span>
                        )}
                      </>
                    )}

                    {activeTab === 'qualif' && (
                      <>
                        <LapTime time={standing.bestTime} size="sm" />
                        {gap !== null && (
                          <span className="font-mono text-xs text-muted-foreground w-16 text-right">
                            +{(gap.value / 1000).toFixed(3)}
                          </span>
                        )}
                      </>
                    )}

                    {activeTab === 'race' && (
                      <>
                        <LapTime time={standing.totalTime || standing.raceTotalTime} size="sm" />
                        {gap !== null && (
                          <span className="font-mono text-xs text-muted-foreground w-16 text-right">
                            +{(gap.value / 1000).toFixed(3)}
                          </span>
                        )}
                        {standing.points !== undefined && (
                          <span className="font-bold text-foreground text-sm w-12 text-right">
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
