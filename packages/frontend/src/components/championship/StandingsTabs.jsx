import LapTime from '../race/LapTime'

/**
 * StandingsTabs - Two tabs for Qualifications and Courses standings
 * Qualif tab: sorted by qualifBestTime
 * Course tab: sorted by raceTotalLaps desc, then raceTotalTime asc
 */
export default function StandingsTabs({ standings = [], activeTab = 'qualif', onTabChange }) {
  const tabs = [
    { id: 'qualif', label: 'Qualifications' },
    { id: 'race', label: 'Courses' }
  ]

  // Sort standings based on active tab
  const sortedStandings = [...standings].sort((a, b) => {
    if (activeTab === 'qualif') {
      // Sort by qualifBestTime (ascending, null/0 at the end)
      const aTime = a.qualifBestTime || Infinity
      const bTime = b.qualifBestTime || Infinity
      return aTime - bTime
    } else {
      // Sort by raceTotalLaps desc, then raceTotalTime asc
      if ((b.raceTotalLaps || 0) !== (a.raceTotalLaps || 0)) {
        return (b.raceTotalLaps || 0) - (a.raceTotalLaps || 0)
      }
      const aTime = a.raceTotalTime || Infinity
      const bTime = b.raceTotalTime || Infinity
      return aTime - bTime
    }
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Tabs Header */}
      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Standings Table */}
      <div className="overflow-x-auto">
        {sortedStandings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucun classement disponible
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pilote</th>
                {activeTab === 'qualif' ? (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Meilleur temps</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ecart</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tours</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Temps total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Points</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedStandings.map((standing, index) => {
                const position = index + 1
                const driver = standing.driver || {}
                const bestTime = activeTab === 'qualif'
                  ? (sortedStandings[0]?.qualifBestTime || 0)
                  : null
                const gap = activeTab === 'qualif' && standing.qualifBestTime && bestTime
                  ? standing.qualifBestTime - bestTime
                  : null

                return (
                  <tr key={standing.id || standing.driverId} className="hover:bg-gray-50">
                    {/* Position */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        position === 1 ? 'bg-yellow-100 text-yellow-700' :
                        position === 2 ? 'bg-gray-200 text-gray-700' :
                        position === 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {position}
                      </span>
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                          style={{ backgroundColor: driver.color || '#3B82F6' }}
                        >
                          {driver.photo ? (
                            <img src={driver.photo} alt={driver.name} className="w-full h-full object-cover" />
                          ) : (
                            (driver.name || 'D').charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{driver.name || 'Pilote inconnu'}</div>
                          {driver.number && (
                            <div className="text-xs text-gray-500">#{driver.number}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {activeTab === 'qualif' ? (
                      <>
                        {/* Best Time */}
                        <td className="px-4 py-3 text-right">
                          <LapTime
                            time={standing.qualifBestTime}
                            size="md"
                            highlight={position === 1 && standing.qualifBestTime > 0}
                          />
                        </td>
                        {/* Gap */}
                        <td className="px-4 py-3 text-right">
                          {position === 1 ? (
                            <span className="text-gray-400">-</span>
                          ) : gap ? (
                            <span className="font-mono text-sm text-gray-600">+{(gap / 1000).toFixed(3)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Total Laps */}
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono font-semibold text-gray-900">
                            {standing.raceTotalLaps || 0}
                          </span>
                        </td>
                        {/* Total Time */}
                        <td className="px-4 py-3 text-right">
                          <LapTime time={standing.raceTotalTime} size="sm" />
                        </td>
                        {/* Points */}
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-gray-900">{standing.points || 0}</span>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
