import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlagIcon,
  UsersIcon,
  TrophyIcon,
  ClockIcon,
  PlusIcon,
  PlayIcon,
  MapPinIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as ClockSolidIcon,
} from '@heroicons/react/24/solid'
import ErrorMessage from '../components/ErrorMessage'
import SessionForm from '../components/SessionForm'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function SessionsList() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all, draft, ready, active, finished
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Filter options
  const [tracks, setTracks] = useState([])
  const [championships, setChampionships] = useState([])

  // Active filters
  const [filters, setFilters] = useState({
    trackId: '',
    type: '',
    championshipId: '',
  })

  useEffect(() => {
    loadFilterOptions()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [filter, filters])

  async function loadFilterOptions() {
    try {
      const [tracksRes, champsRes] = await Promise.all([
        fetch(`${API_URL}/tracks`),
        fetch(`${API_URL}/championships`),
      ])
      const tracksData = await tracksRes.json()
      const champsData = await champsRes.json()
      if (tracksData.success) setTracks(tracksData.data || [])
      if (champsData.success) setChampionships(champsData.data || [])
    } catch (err) {
      console.error('Error loading filter options:', err)
    }
  }

  async function loadSessions() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter !== 'all') params.append('status', filter)
      if (filters.trackId) params.append('trackId', filters.trackId)
      if (filters.type) params.append('type', filters.type)
      if (filters.championshipId) params.append('championshipId', filters.championshipId)

      const res = await fetch(`${API_URL}/sessions?${params}`)
      const data = await res.json()

      if (data.success) {
        setSessions(data.data || [])
      } else {
        setError('Erreur lors du chargement des sessions')
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setError('Impossible de charger les sessions')
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    setFilters({ trackId: '', type: '', championshipId: '' })
  }

  const activeFilterCount = [filters.trackId, filters.type, filters.championshipId].filter(v => v).length

  function getSessionTypeLabel(type) {
    switch (type) {
      case 'practice':
        return 'Essais libres'
      case 'qualif':
        return 'Qualifications'
      case 'race':
        return 'Course'
      default:
        return type
    }
  }

  function getSessionTypeColor(type) {
    switch (type) {
      case 'practice':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
      case 'qualif':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700'
      case 'race':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'draft':
        return <ClockIcon className="h-5 w-5 text-gray-500" />
      case 'ready':
        return <ClockSolidIcon className="h-5 w-5 text-blue-500" />
      case 'active':
        return <PlayIcon className="h-5 w-5 text-green-500 animate-pulse" />
      case 'finished':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />
      default:
        return <XCircleIcon className="h-5 w-5 text-red-500" />
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'draft':
        return 'Brouillon'
      case 'ready':
        return 'Prête'
      case 'active':
        return 'En cours'
      case 'finished':
        return 'Terminée'
      default:
        return status
    }
  }

  function formatDate(date) {
    if (!date) return 'Non définie'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatDuration(startedAt, finishedAt) {
    if (!startedAt || !finishedAt) return null
    const duration = new Date(finishedAt) - new Date(startedAt)
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement des sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sessions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {sessions.length} session{sessions.length > 1 ? 's' : ''} enregistrée
            {sessions.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'draft', label: 'Brouillons' },
              { key: 'active', label: 'En cours' },
              { key: 'finished', label: 'Terminées' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-2 rounded-md transition-all text-sm font-medium ${
                  filter === key
                    ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
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

          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Nouvelle session
          </button>
        </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Type filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Type de session
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Tous les types</option>
                <option value="practice">Essais libres</option>
                <option value="qualif">Qualifications</option>
                <option value="race">Course</option>
              </select>
            </div>

            {/* Championship filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Championnat
              </label>
              <select
                value={filters.championshipId}
                onChange={(e) => setFilters(f => ({ ...f, championshipId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Tous</option>
                <option value="null">Hors championnat</option>
                {championships.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.trackId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-sm">
              {tracks.find(t => t.id === filters.trackId)?.name}
              <button onClick={() => setFilters(f => ({ ...f, trackId: '' }))} className="hover:text-purple-900">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {filters.type && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-sm">
              {getSessionTypeLabel(filters.type)}
              <button onClick={() => setFilters(f => ({ ...f, type: '' }))} className="hover:text-blue-900">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {filters.championshipId && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-sm">
              {filters.championshipId === 'null' ? 'Hors championnat' : championships.find(c => c.id === filters.championshipId)?.name}
              <button onClick={() => setFilters(f => ({ ...f, championshipId: '' }))} className="hover:text-yellow-900">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {/* Sessions List */}
      {sessions.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {sessions.map((session) => {
              const sessionColor = session.track?.color || '#6366f1'
              const duration = formatDuration(session.startedAt, session.finishedAt)

              return (
                <div
                  key={session.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/sessions/${session.id}`)}
                >
                  {/* Color stripe */}
                  <div
                    className="w-1 h-12 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sessionColor }}
                  />

                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(session.status)}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {session.name || `Session #${session.id.slice(0, 8)}`}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getSessionTypeColor(session.type)}`}>
                        {getSessionTypeLabel(session.type)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        {getStatusIcon(session.status)}
                        {getStatusLabel(session.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {session.track?.name || 'Circuit non défini'}
                      </span>
                      {session.championship && (
                        <span className="flex items-center gap-1">
                          <TrophyIcon className="h-3.5 w-3.5 text-yellow-500" />
                          {session.championship.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 flex-shrink-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5" title="Pilotes">
                      <UsersIcon className="h-4 w-4" />
                      {session.drivers?.length || 0}
                    </span>
                    <span className="flex items-center gap-1.5" title="Tours">
                      <FlagIcon className="h-4 w-4" />
                      {session._count?.laps || 0}
                    </span>
                    {duration && (
                      <span className="flex items-center gap-1.5" title="Durée">
                        <ClockIcon className="h-4 w-4" />
                        {duration}
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="hidden md:block flex-shrink-0 text-sm text-gray-500 dark:text-gray-400 w-40 text-right">
                    {formatDate(session.createdAt)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <FlagIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
            {filter === 'all'
              ? 'Aucune session enregistrée'
              : `Aucune session ${getStatusLabel(filter).toLowerCase()}`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Créer la première session
            </button>
          )}
        </div>
      )}

      {/* Session Form Modal */}
      {showForm && (
        <SessionForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            loadSessions()
          }}
        />
      )}
    </div>
  )
}

