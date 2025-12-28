import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarIcon,
  FlagIcon,
  UsersIcon,
  TrophyIcon,
  ClockIcon,
  PlusIcon,
  PlayIcon,
  EyeIcon,
  MapPinIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as ClockSolidIcon,
} from '@heroicons/react/24/solid'
import ErrorMessage from '../components/ErrorMessage'
import SessionForm from '../components/SessionForm'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function SessionsList() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all, draft, ready, active, finished
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [filter])

  async function loadSessions() {
    try {
      setLoading(true)
      let url = `${API_URL}/sessions`
      if (filter !== 'all') {
        url += `?status=${filter}`
      }

      const res = await fetch(url)
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
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 rounded-md transition-all text-sm font-medium ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Toutes
            </button>
            <button
              onClick={() => setFilter('draft')}
              className={`px-3 py-2 rounded-md transition-all text-sm font-medium ${
                filter === 'draft'
                  ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Brouillons
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-2 rounded-md transition-all text-sm font-medium ${
                filter === 'active'
                  ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              En cours
            </button>
            <button
              onClick={() => setFilter('finished')}
              className={`px-3 py-2 rounded-md transition-all text-sm font-medium ${
                filter === 'finished'
                  ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Terminées
            </button>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Nouvelle session
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {/* Sessions Grid */}
      {sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onView={() => navigate(`/sessions/${session.id}`)}
              getSessionTypeLabel={getSessionTypeLabel}
              getSessionTypeColor={getSessionTypeColor}
              getStatusIcon={getStatusIcon}
              getStatusLabel={getStatusLabel}
              formatDate={formatDate}
              formatDuration={formatDuration}
            />
          ))}
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

function SessionCard({
  session,
  onView,
  getSessionTypeLabel,
  getSessionTypeColor,
  getStatusIcon,
  getStatusLabel,
  formatDate,
  formatDuration,
}) {
  const sessionColor = session.track?.color || '#6366f1'
  const duration = formatDuration(session.startedAt, session.finishedAt)

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group bg-white dark:bg-gray-800 cursor-pointer"
      onClick={onView}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${sessionColor},
            ${sessionColor} 10px,
            transparent 10px,
            transparent 20px
          )`,
        }}
      />

      {/* Header with track photo */}
      <div className="relative h-32 overflow-hidden">
        {session.track?.img ? (
          <img
            src={session.track.img}
            alt={session.track.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${sessionColor} 0%, ${sessionColor}CC 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full flex items-center gap-2">
          {getStatusIcon(session.status)}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {getStatusLabel(session.status)}
          </span>
        </div>

        {/* Type badge */}
        <div
          className={`absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-bold border ${getSessionTypeColor(
            session.type
          )}`}
        >
          {getSessionTypeLabel(session.type)}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-6">
        {/* Session name and track */}
        <div className="mb-4">
          <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-1">
            {session.name || `Session #${session.id.slice(0, 8)}`}
          </h3>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <MapPinIcon className="h-4 w-4" />
            <span className="text-sm">{session.track?.name || 'Circuit non défini'}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-lg p-2">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
              <UsersIcon className="h-4 w-4" />
              <span className="text-xs">Pilotes</span>
            </div>
            <span className="text-lg font-bold" style={{ color: sessionColor }}>
              {session.drivers?.length || 0}
            </span>
          </div>

          <div className="bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm rounded-lg p-2">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
              <FlagIcon className="h-4 w-4" />
              <span className="text-xs">Tours</span>
            </div>
            <span className="text-lg font-bold" style={{ color: sessionColor }}>
              {session._count?.laps || 0}
            </span>
          </div>
        </div>

        {/* Date and duration */}
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>{formatDate(session.createdAt)}</span>
          </div>
          {duration && (
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              <span>Durée : {duration}</span>
            </div>
          )}
        </div>

        {/* Championship badge */}
        {session.championship && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <TrophyIcon className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {session.championship.name}
              </span>
            </div>
          </div>
        )}

        {/* View button */}
        <button
          className="absolute top-6 right-6 w-10 h-10 bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 hover:scale-110 transition-all shadow-md"
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
        >
          <EyeIcon className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      {/* Racing stripe */}
      <div
        className="absolute top-0 left-0 w-1 h-full opacity-80"
        style={{ backgroundColor: sessionColor }}
      />
    </div>
  )
}