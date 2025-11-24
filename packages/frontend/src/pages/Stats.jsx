import { useState, useEffect } from 'react'
import {
  TrophyIcon,
  ChartBarIcon,
  UserGroupIcon,
  FlagIcon,
  ClockIcon,
  BoltIcon,
  FireIcon,
} from '@heroicons/react/24/outline'
import {
  TrophyIcon as TrophySolidIcon,
  StarIcon,
} from '@heroicons/react/24/solid'
import ErrorMessage from '../components/ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Stats() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Data states
  const [driverLeaderboard, setDriverLeaderboard] = useState([])
  const [teamLeaderboard, setTeamLeaderboard] = useState([])
  const [driverStats, setDriverStats] = useState([])
  const [carStats, setCarStats] = useState([])
  const [trackStats, setTrackStats] = useState([])
  const [records, setRecords] = useState(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      if (activeTab === 'leaderboard') {
        await Promise.all([loadDriverLeaderboard(), loadTeamLeaderboard()])
      } else if (activeTab === 'drivers') {
        await loadDriverStats()
      } else if (activeTab === 'cars') {
        await loadCarStats()
      } else if (activeTab === 'tracks') {
        await loadTrackStats()
      } else if (activeTab === 'records') {
        await loadRecords()
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  async function loadDriverLeaderboard() {
    const res = await fetch(`${API_URL}/stats/leaderboard/drivers?limit=10`)
    const data = await res.json()
    if (data.success) {
      setDriverLeaderboard(data.data || [])
    }
  }

  async function loadTeamLeaderboard() {
    const res = await fetch(`${API_URL}/stats/leaderboard/teams`)
    const data = await res.json()
    if (data.success) {
      setTeamLeaderboard(data.data || [])
    }
  }

  async function loadDriverStats() {
    const res = await fetch(`${API_URL}/stats/drivers`)
    const data = await res.json()
    if (data.success) {
      setDriverStats(data.data || [])
    }
  }

  async function loadCarStats() {
    const res = await fetch(`${API_URL}/stats/cars`)
    const data = await res.json()
    if (data.success) {
      setCarStats(data.data || [])
    }
  }

  async function loadTrackStats() {
    const res = await fetch(`${API_URL}/stats/tracks`)
    const data = await res.json()
    if (data.success) {
      setTrackStats(data.data || [])
    }
  }

  async function loadRecords() {
    const res = await fetch(`${API_URL}/stats/records`)
    const data = await res.json()
    if (data.success) {
      setRecords(data.data)
    }
  }

  function formatTime(ms) {
    if (!ms) return '-'
    const seconds = ms / 1000
    const minutes = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(3)
    return minutes > 0 ? `${minutes}:${secs.padStart(6, '0')}` : `${secs}s`
  }

  const tabs = [
    { id: 'leaderboard', label: 'Classements', icon: TrophyIcon },
    { id: 'drivers', label: 'Pilotes', icon: UserGroupIcon },
    { id: 'cars', label: 'Voitures', icon: BoltIcon },
    { id: 'tracks', label: 'Circuits', icon: FlagIcon },
    { id: 'records', label: 'Records', icon: StarIcon },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Statistiques & Classements</h1>
        <p className="text-gray-600 mt-1">Analyse des performances et records</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement des statistiques...</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Driver Leaderboard */}
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <TrophyIcon className="w-6 h-6" />
                    Classement Pilotes
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {driverLeaderboard.map((entry, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                              index === 0
                                ? 'bg-yellow-500'
                                : index === 1
                                ? 'bg-gray-400'
                                : index === 2
                                ? 'bg-orange-600'
                                : 'bg-gray-600'
                            }`}
                          >
                            {entry.position || index + 1}
                          </div>
                          <div className="flex items-center gap-3">
                            {entry.driver?.photo ? (
                              <img
                                src={entry.driver.photo}
                                alt={entry.driver.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                style={{
                                  backgroundColor: entry.driver?.color || '#6366f1',
                                }}
                              >
                                {entry.driver?.name?.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-900">
                                {entry.driver?.name}
                              </p>
                              {entry.driver?.team && (
                                <p className="text-sm text-gray-500">{entry.driver.team.name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {entry.points !== undefined ? (
                            <>
                              <p className="font-bold text-lg text-gray-900">{entry.points} pts</p>
                              {entry.gap && (
                                <p className="text-sm text-gray-500">-{entry.gap} pts</p>
                              )}
                            </>
                          ) : (
                            <div className="flex gap-3 text-sm">
                              <div className="text-center">
                                <p className="font-bold text-yellow-500">{entry.wins || 0}</p>
                                <p className="text-gray-500">V</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-gray-600">{entry.podiums || 0}</p>
                                <p className="text-gray-500">P</p>
                              </div>
                              <div className="text-center">
                                <p className="font-bold text-gray-600">{entry.races || 0}</p>
                                <p className="text-gray-500">C</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {driverLeaderboard.length === 0 && (
                    <div className="p-8 text-center text-gray-500">Aucune donnée disponible</div>
                  )}
                </div>
              </div>

              {/* Team Leaderboard */}
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <UserGroupIcon className="w-6 h-6" />
                    Classement Équipes
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {teamLeaderboard.map((entry, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                              index === 0
                                ? 'bg-yellow-500'
                                : index === 1
                                ? 'bg-gray-400'
                                : index === 2
                                ? 'bg-orange-600'
                                : 'bg-gray-600'
                            }`}
                          >
                            {entry.position}
                          </div>
                          <div className="flex items-center gap-3">
                            {entry.team?.logo ? (
                              <img
                                src={entry.team.logo}
                                alt={entry.team.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
                                style={{
                                  backgroundColor: entry.team?.color || '#f97316',
                                }}
                              >
                                {entry.team?.name?.charAt(0)}
                              </div>
                            )}
                            <p className="font-semibold text-gray-900">{entry.team?.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">{entry.points} pts</p>
                          {entry.gap && <p className="text-sm text-gray-500">-{entry.gap} pts</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {teamLeaderboard.length === 0 && (
                    <div className="p-8 text-center text-gray-500">Aucune donnée disponible</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Driver Stats Tab */}
          {activeTab === 'drivers' && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pilote
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Courses
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Victoires
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Podiums
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tours
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Meilleur Tour
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Temps Moyen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {driverStats.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {driver.photo ? (
                            <img
                              src={driver.photo}
                              alt={driver.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: driver.color }}
                            >
                              {driver.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{driver.name}</p>
                            {driver.team && (
                              <p className="text-sm text-gray-500">{driver.team.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {driver.statistics.totalRaces}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-yellow-600">
                          {driver.statistics.wins}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {driver.statistics.podiums}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {driver.statistics.totalLaps}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-sm">
                        {formatTime(driver.statistics.bestLap)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-sm">
                        {formatTime(driver.statistics.avgLapTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {driverStats.length === 0 && (
                <div className="p-8 text-center text-gray-500">Aucune donnée disponible</div>
              )}
            </div>
          )}

          {/* Car Stats Tab */}
          {activeTab === 'cars' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {carStats.map((car) => (
                <div key={car.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div
                    className="h-2"
                    style={{ backgroundColor: car.color || '#10b981' }}
                  />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{car.brand}</h3>
                        <p className="text-gray-600">{car.model}</p>
                        {car.year && <p className="text-sm text-gray-500">{car.year}</p>}
                      </div>
                      {car.photo && (
                        <img
                          src={car.photo}
                          alt={`${car.brand} ${car.model}`}
                          className="w-16 h-16 rounded object-cover"
                        />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Courses</span>
                        <span className="font-semibold">{car.statistics.totalRaces}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Victoires</span>
                        <span className="font-bold text-yellow-600">
                          {car.statistics.wins}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tours</span>
                        <span className="font-semibold">{car.statistics.totalLaps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Meilleur tour</span>
                        <span className="font-mono text-sm">
                          {formatTime(car.statistics.bestLap)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fiabilité</span>
                        <span className="font-semibold">
                          {car.statistics.reliability.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {carStats.length === 0 && (
                <div className="col-span-3 p-8 text-center text-gray-500 bg-white rounded-lg shadow">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          )}

          {/* Track Stats Tab */}
          {activeTab === 'tracks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trackStats.map((track) => (
                <div key={track.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div
                    className="h-2"
                    style={{ backgroundColor: track.color || '#9333ea' }}
                  />
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="font-bold text-lg text-gray-900">{track.name}</h3>
                      <div className="flex gap-4 text-sm text-gray-600 mt-1">
                        {track.length && <span>{track.length}m</span>}
                        {track.corners && <span>{track.corners} virages</span>}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sessions</span>
                        <span className="font-semibold">{track.statistics.totalSessions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tours totaux</span>
                        <span className="font-semibold">{track.statistics.totalLaps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Record</span>
                        <span className="font-mono text-sm">
                          {formatTime(track.statistics.bestLap)}
                        </span>
                      </div>
                      {track.statistics.bestLapBy && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Par</span>
                          <span className="font-semibold">{track.statistics.bestLapBy}</span>
                        </div>
                      )}
                      {track.statistics.avgSessionDuration && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Durée moyenne</span>
                          <span className="font-semibold">
                            {track.statistics.avgSessionDuration.toFixed(0)} min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {trackStats.length === 0 && (
                <div className="col-span-3 p-8 text-center text-gray-500 bg-white rounded-lg shadow">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          )}

          {/* Records Tab */}
          {activeTab === 'records' && records && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fastest Lap */}
              {records.fastestLap && (
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <ClockIcon className="w-8 h-8" />
                    <h3 className="text-xl font-bold">Tour le plus rapide</h3>
                  </div>
                  <div className="text-3xl font-bold mb-2">
                    {formatTime(records.fastestLap.time)}
                  </div>
                  <p className="text-purple-100">{records.fastestLap.driver.name}</p>
                  <p className="text-sm text-purple-200">
                    {records.fastestLap.car.brand} {records.fastestLap.car.model}
                  </p>
                  <p className="text-sm text-purple-200 mt-2">
                    {records.fastestLap.track.name}
                  </p>
                </div>
              )}

              {/* Most Wins */}
              {records.mostWins && (
                <div className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <TrophySolidIcon className="w-8 h-8" />
                    <h3 className="text-xl font-bold">Plus de victoires</h3>
                  </div>
                  <div className="text-3xl font-bold mb-2">
                    {records.mostWins.count}
                  </div>
                  <p className="text-yellow-100">{records.mostWins.driver.name}</p>
                </div>
              )}

              {/* Most Podiums */}
              {records.mostPodiums && (
                <div className="bg-gradient-to-br from-gray-600 to-gray-800 text-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <ChartBarIcon className="w-8 h-8" />
                    <h3 className="text-xl font-bold">Plus de podiums</h3>
                  </div>
                  <div className="text-3xl font-bold mb-2">
                    {records.mostPodiums.count}
                  </div>
                  <p className="text-gray-200">{records.mostPodiums.driver.name}</p>
                </div>
              )}

              {/* Most Pole Positions */}
              {records.mostPolePositions && (
                <div className="bg-gradient-to-br from-green-500 to-teal-600 text-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FlagIcon className="w-8 h-8" />
                    <h3 className="text-xl font-bold">Plus de pole positions</h3>
                  </div>
                  <div className="text-3xl font-bold mb-2">
                    {records.mostPolePositions.count}
                  </div>
                  <p className="text-green-100">{records.mostPolePositions.driver.name}</p>
                </div>
              )}

              {!records.fastestLap && !records.mostWins && !records.mostPodiums && !records.mostPolePositions && (
                <div className="col-span-2 p-8 text-center text-gray-500 bg-white rounded-lg shadow">
                  Aucun record disponible pour le moment
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}