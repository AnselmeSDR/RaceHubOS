/**
 * SessionDetail - View session history details (read-only)
 *
 * NOTE: This page is for viewing completed session history.
 * For live race control, use /race (RaceControl page).
 */
import { ArrowLeftIcon, BoltIcon, ClockIcon, FlagIcon, MapPinIcon, TrashIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phaseLeaderboards, setPhaseLeaderboards] = useState({
    practice: [],
    qualif: [],
    race: []
  })
  const [activePhaseTab, setActivePhaseTab] = useState('practice')

  useEffect(() => {
    loadSession()
    loadAllLeaderboards()
  }, [id])

  async function loadSession() {
    try {
      const res = await fetch(`${API_URL}/sessions/${id}`)
      const data = await res.json()

      if (data.success) {
        setSession(data.data)
      } else {
        setError('Session introuvable')
      }
    } catch (err) {
      console.error('Error loading session:', err)
      setError('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  async function loadAllLeaderboards() {
    try {
      const phases = ['practice', 'qualif', 'race']
      const results = await Promise.all(
        phases.map(phase =>
          fetch(`${API_URL}/stats/leaderboard/drivers?sessionId=${id}&phase=${phase}`)
            .then(res => res.json())
        )
      )

      const newLeaderboards = {}
      phases.forEach((phase, index) => {
        if (results[index].success) {
          newLeaderboards[phase] = results[index].data || []
        }
      })

      setPhaseLeaderboards(newLeaderboards)
    } catch (err) {
      console.error('Error loading leaderboards:', err)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`${API_URL}/sessions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        navigate('/history')
      } else {
        setError('Erreur lors de la suppression')
      }
    } catch (err) {
      console.error('Error deleting session:', err)
      setError('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Chargement de la session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-8"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Retour à l'historique
        </button>
        <div className="text-center text-gray-500">Session introuvable</div>
      </div>
    )
  }

  const sessionColor = session.track?.color || '#6366F1'

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="relative"
        style={{
          background: session.track?.img
            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${session.track.img})`
            : `linear-gradient(135deg, ${sessionColor} 0%, ${sessionColor}dd 100%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="max-w-7xl mx-auto p-8">
          {/* Navigation */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Retour
            </button>
          </div>

          {/* Session Info */}
          <div className="flex items-start justify-between gap-6 text-white pb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  session.type === 'race' ? 'bg-green-500/30 border border-green-400' :
                  session.type === 'qualif' ? 'bg-purple-500/30 border border-purple-400' :
                  'bg-blue-500/30 border border-blue-400'
                }`}>
                  {session.type === 'race' ? 'Course' : session.type === 'qualif' ? 'Qualifications' : 'Essais'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  session.status === 'finished' ? 'bg-blue-500/30 border border-blue-400' :
                  session.status === 'active' ? 'bg-green-500/30 border border-green-400' :
                  'bg-gray-500/30 border border-gray-400'
                }`}>
                  {session.status === 'finished' ? 'Terminée' : session.status === 'active' ? 'Active' : session.status}
                </span>
              </div>
              <h1 className="text-4xl font-bold mb-2">
                {session.name || `Session #${session.id.slice(0, 8)}`}
              </h1>
              <p className="text-white/70">
                {formatDate(session.createdAt)}
              </p>
            </div>

            <button
              onClick={handleDelete}
              className="p-3 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-600 transition-all"
              title="Supprimer la session"
            >
              <TrashIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 -mt-8 relative z-10 pb-8">
        {error && (
          <div className="mb-6">
            <ErrorMessage type="error" message={error} onClose={() => setError('')} />
          </div>
        )}

        {/* Stats Cards */}
        <div className="flex flex-wrap gap-6 mb-8">
          {/* Circuit */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
            <div className="flex items-center gap-3 mb-3">
              <MapPinIcon className="w-8 h-8 text-indigo-500" />
              <span className="text-xl font-bold text-gray-900">{session.track?.name}</span>
            </div>
            <p className="text-gray-600">Circuit</p>
          </div>

          {/* Pilotes */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
            <div className="flex items-center gap-3 mb-3">
              <UsersIcon className="w-8 h-8 text-indigo-500" />
              <span className="text-3xl font-bold text-gray-900">{session.drivers?.length || 0}</span>
            </div>
            <p className="text-gray-600">Pilotes</p>
          </div>

          {/* Tours */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
            <div className="flex items-center gap-3 mb-3">
              <FlagIcon className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-gray-900">{session._count?.laps || 0}</span>
            </div>
            <p className="text-gray-600">Tours complétés</p>
          </div>

          {/* Championnat */}
          {session.championship && (
            <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
              <div className="flex items-center gap-3 mb-3">
                <TrophyIcon className="w-8 h-8 text-yellow-500" />
                <span className="text-xl font-bold text-gray-900">{session.championship.name}</span>
              </div>
              <p className="text-gray-600">Championnat</p>
            </div>
          )}
        </div>

        {/* Leaderboard Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {['practice', 'qualif', 'race'].map((phase) => (
                <button
                  key={phase}
                  onClick={() => setActivePhaseTab(phase)}
                  className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${
                    activePhaseTab === phase
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {phase === 'practice' && <ClockIcon className="w-5 h-5" />}
                  {phase === 'qualif' && <BoltIcon className="w-5 h-5" />}
                  {phase === 'race' && <FlagIcon className="w-5 h-5" />}
                  {phase === 'practice' ? 'Essais' : phase === 'qualif' ? 'Qualifications' : 'Course'}
                  {phaseLeaderboards[phase]?.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {phaseLeaderboards[phase].length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">
            {phaseLeaderboards[activePhaseTab]?.length > 0 ? (
              <div className="space-y-4">
                {phaseLeaderboards[activePhaseTab].map((entry, idx) => (
                  <div
                    key={entry.driver?.id || idx}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      idx === 0 ? 'bg-yellow-50 border-2 border-yellow-300' :
                      idx === 1 ? 'bg-gray-50 border-2 border-gray-300' :
                      idx === 2 ? 'bg-orange-50 border-2 border-orange-300' :
                      'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl font-bold ${
                        idx === 0 ? 'text-yellow-600' :
                        idx === 1 ? 'text-gray-600' :
                        idx === 2 ? 'text-orange-600' :
                        'text-gray-900'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex items-center gap-3">
                        {entry.driver?.img ? (
                          <img
                            src={entry.driver.img}
                            alt={entry.driver.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                            style={{ backgroundColor: entry.driver?.color || sessionColor }}
                          >
                            {entry.driver?.name?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900">{entry.driver?.name}</p>
                          <p className="text-sm text-gray-600">
                            {entry.car?.brand} {entry.car?.model}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{entry.laps || 0} tours</p>
                      {entry.bestLap && (
                        <p className="text-sm text-gray-600">
                          Meilleur : {(entry.bestLap / 1000).toFixed(3)}s
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FlagIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="font-medium">Aucune donnée pour cette phase</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
