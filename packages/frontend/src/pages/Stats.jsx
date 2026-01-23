import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrophyIcon,
  ChartBarIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const sessionTypeLabels = {
  race: { label: 'Course', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  qualif: { label: 'Qualif', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  practice: { label: 'Essais', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function Stats() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [laptimes, setLaptimes] = useState([])

  // Filter options
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])

  // Active filters
  const [filters, setFilters] = useState({
    driverId: '',
    carId: '',
    trackId: '',
    sessionType: '',
    limit: '50',
  })

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'lapTime', direction: 'asc' })

  // Show filters panel
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadFilterOptions()
    loadLaptimes()
  }, [])

  useEffect(() => {
    loadLaptimes()
  }, [filters])

  async function loadFilterOptions() {
    try {
      const [driversRes, carsRes, tracksRes] = await Promise.all([
        fetch(`${API_URL}/api/drivers`),
        fetch(`${API_URL}/api/cars`),
        fetch(`${API_URL}/api/tracks`),
      ])

      const driversData = await driversRes.json()
      const carsData = await carsRes.json()
      const tracksData = await tracksRes.json()

      if (driversData.success) setDrivers(driversData.data || [])
      if (carsData.success) setCars(carsData.data || [])
      if (tracksData.success) setTracks(tracksData.data || [])
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  async function loadLaptimes() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.driverId) params.append('driverId', filters.driverId)
      if (filters.carId) params.append('carId', filters.carId)
      if (filters.trackId) params.append('trackId', filters.trackId)
      if (filters.sessionType) params.append('sessionType', filters.sessionType)
      params.append('limit', filters.limit || '50')

      const res = await fetch(`${API_URL}/api/stats/laptimes?${params}`)
      const data = await res.json()

      if (data.success) {
        setLaptimes(data.data || [])
      }
    } catch (error) {
      console.error('Error loading laptimes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Sort laptimes
  const sortedLaptimes = useMemo(() => {
    const sorted = [...laptimes]
    sorted.sort((a, b) => {
      let aVal, bVal

      switch (sortConfig.key) {
        case 'lapTime':
          aVal = a.lapTime
          bVal = b.lapTime
          break
        case 'driver':
          aVal = a.driver?.name || ''
          bVal = b.driver?.name || ''
          break
        case 'car':
          aVal = `${a.car?.brand} ${a.car?.model}`
          bVal = `${b.car?.brand} ${b.car?.model}`
          break
        case 'track':
          aVal = a.track?.name || ''
          bVal = b.track?.name || ''
          break
        case 'sessionType':
          aVal = a.sessionType
          bVal = b.sessionType
          break
        case 'date':
          aVal = new Date(a.sessionDate)
          bVal = new Date(b.sessionDate)
          break
        default:
          aVal = a.lapTime
          bVal = b.lapTime
      }

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
    })
    return sorted
  }, [laptimes, sortConfig])

  function handleSort(key) {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  function clearFilters() {
    setFilters({ driverId: '', carId: '', trackId: '', sessionType: '', limit: '50' })
  }

  const activeFilterCount = [filters.driverId, filters.carId, filters.trackId, filters.sessionType].filter(v => v).length

  function formatTime(ms) {
    if (!ms) return '-'
    return (ms / 1000).toFixed(3) + 's'
  }

  function SortHeader({ label, sortKey }) {
    const isActive = sortConfig.key === sortKey
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortConfig.direction === 'asc' ? (
              <ChevronUpIcon className="w-4 h-4 text-indigo-500" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-indigo-500" />
            )
          ) : (
            <ArrowsUpDownIcon className="w-4 h-4 opacity-30" />
          )}
        </div>
      </th>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ChartBarIcon className="w-7 h-7 text-indigo-500" />
            Statistiques & Records
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sortedLaptimes.length} record{sortedLaptimes.length > 1 ? 's' : ''} trouvé{sortedLaptimes.length > 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <FunnelIcon className="w-5 h-5" />
          Filtres
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500 text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filtres</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <XMarkIcon className="w-4 h-4" />
                Effacer tout
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Driver filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Pilote
              </label>
              <select
                value={filters.driverId}
                onChange={(e) => setFilters(f => ({ ...f, driverId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Tous les pilotes</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Car filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Voiture
              </label>
              <select
                value={filters.carId}
                onChange={(e) => setFilters(f => ({ ...f, carId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Toutes les voitures</option>
                {cars.map(c => (
                  <option key={c.id} value={c.id}>{c.brand} {c.model}</option>
                ))}
              </select>
            </div>

            {/* Track filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Circuit
              </label>
              <select
                value={filters.trackId}
                onChange={(e) => setFilters(f => ({ ...f, trackId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Tous les circuits</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Session type filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Type de session
              </label>
              <select
                value={filters.sessionType}
                onChange={(e) => setFilters(f => ({ ...f, sessionType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Tous les types</option>
                <option value="practice">Essais</option>
                <option value="qualif">Qualifications</option>
                <option value="race">Course</option>
              </select>
            </div>

            {/* Limit filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Nombre max
              </label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters(f => ({ ...f, limit: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.driverId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-sm">
              {drivers.find(d => d.id === filters.driverId)?.name}
              <button onClick={() => setFilters(f => ({ ...f, driverId: '' }))} className="hover:text-blue-900">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {filters.carId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm">
              {cars.find(c => c.id === filters.carId)?.brand} {cars.find(c => c.id === filters.carId)?.model}
              <button onClick={() => setFilters(f => ({ ...f, carId: '' }))} className="hover:text-green-900">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {filters.trackId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-sm">
              {tracks.find(t => t.id === filters.trackId)?.name}
              <button onClick={() => setFilters(f => ({ ...f, trackId: '' }))} className="hover:text-purple-900">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {filters.sessionType && (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${sessionTypeLabels[filters.sessionType]?.color}`}>
              {sessionTypeLabels[filters.sessionType]?.label}
              <button onClick={() => setFilters(f => ({ ...f, sessionType: '' }))}>
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : sortedLaptimes.length === 0 ? (
          <div className="text-center py-16">
            <TrophyIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Aucun record trouvé</p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <SortHeader label="Temps" sortKey="lapTime" />
                  <SortHeader label="Pilote" sortKey="driver" />
                  <SortHeader label="Voiture" sortKey="car" />
                  <SortHeader label="Circuit" sortKey="track" />
                  <SortHeader label="Session" sortKey="sessionType" />
                  <SortHeader label="Date" sortKey="date" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedLaptimes.map((lap, index) => {
                  const sessionInfo = sessionTypeLabels[lap.sessionType] || sessionTypeLabels.practice
                  const isTop3 = index < 3 && sortConfig.key === 'lapTime' && sortConfig.direction === 'asc'

                  return (
                    <tr
                      key={lap.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isTop3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}
                    >
                      {/* Position */}
                      <td className="px-4 py-3">
                        {isTop3 ? (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                          }`}>
                            {index === 0 ? <TrophySolidIcon className="w-4 h-4" /> : index + 1}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 font-medium">{index + 1}</span>
                        )}
                      </td>

                      {/* Lap time */}
                      <td className="px-4 py-3">
                        <span className={`font-mono font-bold text-lg ${isTop3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                          {formatTime(lap.lapTime)}
                        </span>
                      </td>

                      {/* Driver */}
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                          onClick={() => navigate(`/drivers/${lap.driver?.id}`)}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0"
                            style={{ backgroundColor: lap.driver?.color || '#666' }}
                          >
                            {lap.driver?.img ? (
                              <img src={getImgUrl(lap.driver.img)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              lap.driver?.name?.charAt(0)
                            )}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {lap.driver?.name}
                          </span>
                        </div>
                      </td>

                      {/* Car */}
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                          onClick={() => navigate(`/cars/${lap.car?.id}`)}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0"
                            style={{ backgroundColor: lap.car?.color || '#666' }}
                          >
                            {lap.car?.img ? (
                              <img src={getImgUrl(lap.car.img)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              lap.car?.brand?.charAt(0)
                            )}
                          </div>
                          <span className="text-gray-700 dark:text-gray-300 truncate">
                            {lap.car?.brand} {lap.car?.model}
                          </span>
                        </div>
                      </td>

                      {/* Track */}
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                          onClick={() => navigate(`/tracks/${lap.track?.id}`)}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: lap.track?.color || '#666' }}
                          />
                          <span className="text-gray-700 dark:text-gray-300 truncate">
                            {lap.track?.name}
                          </span>
                        </div>
                      </td>

                      {/* Session type */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${sessionInfo.color}`}>
                          {sessionInfo.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
                        {lap.sessionDate ? new Date(lap.sessionDate).toLocaleDateString('fr-FR') : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
