import LapTime from './LapTime'
import GapDisplay from './GapDisplay'

/**
 * Leaderboard - Real-time race leaderboard table
 * Displays driver standings with lap times and gaps
 */
export default function Leaderboard({ leaderboard = [], sessionType = 'race' }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No entries in the leaderboard
      </div>
    )
  }

  // Get position badge styling
  const getPositionStyle = (position) => {
    switch (position) {
      case 1:
        return 'bg-yellow-400 text-yellow-900'
      case 2:
        return 'bg-gray-300 text-gray-800'
      case 3:
        return 'bg-orange-400 text-orange-900'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  // Column headers based on session type
  const getHeaders = () => {
    const base = ['Pos', 'Driver', 'Car', 'Laps', 'Best Lap', 'Last Lap', 'Gap']
    return base
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900 text-white text-sm uppercase tracking-wide">
              {getHeaders().map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaderboard.map((entry, index) => {
              const position = entry.position || index + 1
              const driver = entry.driver || {}
              const car = entry.car || {}

              return (
                <tr
                  key={entry.id || index}
                  className={`
                    hover:bg-gray-50 transition-colors
                    ${entry.positionChanged ? 'animate-pulse bg-blue-50' : ''}
                  `}
                >
                  {/* Position */}
                  <td className="px-4 py-3">
                    <div
                      className={`
                        w-8 h-8 rounded-lg flex items-center justify-center
                        font-bold text-sm ${getPositionStyle(position)}
                      `}
                    >
                      {position}
                    </div>
                  </td>

                  {/* Driver */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Driver photo/avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${driver.color || '#6B7280'} 0%, ${driver.color || '#6B7280'}CC 100%)`,
                        }}
                      >
                        {driver.photo ? (
                          <img
                            src={driver.photo}
                            alt={driver.name || 'Driver'}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{(driver.name || 'D').charAt(0)}</span>
                        )}
                      </div>
                      {/* Driver name */}
                      <div>
                        <div className="font-bold text-gray-900 uppercase tracking-wide">
                          {driver.name || 'Unknown'}
                        </div>
                        {driver.number && (
                          <div className="text-xs text-gray-500">
                            #{driver.number}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Car */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {car.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: car.color }}
                        />
                      )}
                      <span className="text-gray-700 text-sm">
                        {car.name || car.model || '--'}
                      </span>
                    </div>
                  </td>

                  {/* Laps */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-gray-900 tabular-nums">
                      {entry.laps ?? entry.lapCount ?? 0}
                    </span>
                  </td>

                  {/* Best Lap */}
                  <td className="px-4 py-3">
                    <LapTime
                      time={entry.bestLap}
                      size="md"
                      highlight={entry.hasFastestLap}
                    />
                  </td>

                  {/* Last Lap */}
                  <td className="px-4 py-3">
                    <LapTime time={entry.lastLap} size="md" />
                  </td>

                  {/* Gap */}
                  <td className="px-4 py-3">
                    <GapDisplay gap={entry.gap} position={position} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-200">
        {leaderboard.map((entry, index) => {
          const position = entry.position || index + 1
          const driver = entry.driver || {}
          const car = entry.car || {}

          return (
            <div
              key={entry.id || index}
              className={`
                p-4 ${entry.positionChanged ? 'animate-pulse bg-blue-50' : ''}
              `}
            >
              {/* Top row: Position, Driver, Gap */}
              <div className="flex items-center gap-3 mb-3">
                {/* Position */}
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    font-bold ${getPositionStyle(position)}
                  `}
                >
                  {position}
                </div>

                {/* Driver */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${driver.color || '#6B7280'} 0%, ${driver.color || '#6B7280'}CC 100%)`,
                  }}
                >
                  {driver.photo ? (
                    <img
                      src={driver.photo}
                      alt={driver.name || 'Driver'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{(driver.name || 'D').charAt(0)}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 uppercase truncate">
                    {driver.name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {car.name || car.model || '--'}
                  </div>
                </div>

                <GapDisplay gap={entry.gap} position={position} />
              </div>

              {/* Bottom row: Stats */}
              <div className="grid grid-cols-3 gap-4 text-center bg-gray-50 rounded-lg p-2">
                <div>
                  <div className="text-xs text-gray-500 uppercase">Laps</div>
                  <div className="font-mono font-bold">
                    {entry.laps ?? entry.lapCount ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Best</div>
                  <LapTime
                    time={entry.bestLap}
                    size="sm"
                    highlight={entry.hasFastestLap}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Last</div>
                  <LapTime time={entry.lastLap} size="sm" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
