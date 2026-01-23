import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  FlagIcon
} from '@heroicons/react/24/outline'
import { MapPinIcon as MapPinSolidIcon, TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import { RecordsList } from '../components/RecordDisplays'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const PRIMARY_COLOR = '#9333EA'

export default function TrackProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadTrack()
  }, [id])

  async function loadTrack() {
    try {
      const res = await fetch(`${API_URL}/api/tracks/${id}`)
      if (!res.ok) {
        console.error('Failed to load track: HTTP', res.status)
        return
      }
      const data = await res.json()
      setTrack(data.data)
    } catch (error) {
      console.error('Failed to load track:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetStats() {
    if (!confirm('Remettre à zéro toutes les statistiques de ce circuit ?')) return

    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/api/tracks/${id}/reset-stats`, { method: 'POST' })
      if (res.ok) {
        loadTrack()
      }
    } catch (error) {
      console.error('Failed to reset stats:', error)
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!track) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">Circuit non trouvé</p>
          <button
            onClick={() => navigate('/tracks')}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retour aux circuits
          </button>
        </div>
      </div>
    )
  }

  const trackColor = track.color || PRIMARY_COLOR

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/tracks')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">Retour aux circuits</span>
        </button>

        <button
          onClick={handleResetStats}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
          Reset stats
        </button>
      </div>

      {/* Track Header */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${trackColor}20 0%, ${trackColor}05 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${trackColor}, ${trackColor} 10px, transparent 10px, transparent 20px)`
          }}
        />

        <div className="relative p-8">
          <div className="flex items-start gap-6">
            {/* Track image */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-2xl blur-xl opacity-50"
                style={{ backgroundColor: trackColor }}
              />
              <div
                className="relative w-32 h-32 rounded-2xl flex items-center justify-center text-white ring-4 ring-white shadow-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${trackColor} 0%, ${trackColor}CC 100%)`,
                }}
              >
                {track.img ? (
                  <img
                    src={track.img}
                    alt={track.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MapPinSolidIcon className="w-16 h-16 drop-shadow-lg" />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1
                className="font-black text-4xl tracking-tight mb-2"
                style={{ color: trackColor }}
              >
                {track.name.toUpperCase()}
              </h1>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {track.length && (
                  <SpecCard
                    icon={<RocketLaunchIcon className="w-5 h-5" />}
                    label="Longueur"
                    value={`${track.length}m`}
                    color={trackColor}
                  />
                )}
                {track.corners && (
                  <SpecCard
                    icon={<ArrowPathIcon className="w-5 h-5" />}
                    label="Virages"
                    value={track.corners}
                    color={trackColor}
                  />
                )}
                <SpecCard
                  icon={<FlagIcon className="w-5 h-5" />}
                  label="Courses"
                  value={track._count?.sessions || 0}
                  color={trackColor}
                />
              </div>

              {/* Best lap */}
              {track.bestLap && (
                <div className="mt-6 inline-block">
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg px-6 py-3 shadow-md">
                    <div className="flex items-center gap-2 mb-1">
                      <TrophySolidIcon className="w-5 h-5 text-yellow-600" />
                      <span className="text-xs text-yellow-900 dark:text-yellow-300 uppercase tracking-wide font-bold">
                        Record du circuit
                      </span>
                    </div>
                    <div className="text-3xl font-black tabular-nums text-yellow-600 dark:text-yellow-400">
                      {(track.bestLap / 1000).toFixed(3)}s
                    </div>
                    {track.bestLapBy && (
                      <div className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                        par {track.bestLapBy}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="absolute top-0 left-0 w-2 h-full"
          style={{ backgroundColor: trackColor }}
        />
      </div>

      {/* Stats & Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track Records */}
        <RecordsList
          title="Top 10 Records"
          records={track.records}
          primaryColor={trackColor}
          showDriverAvatar={true}
          showCarAvatar={true}
          showCar={true}
          showTrack={false}
        />

        {/* Recent Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sessions récentes</h2>
          {track.sessions && track.sessions.length > 0 ? (
            <div className="space-y-3">
              {track.sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => navigate(`/sessions/${session.id}`)}
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {session.type === 'race' ? 'Course' :
                       session.type === 'qualif' ? 'Qualifications' :
                       'Essais'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black" style={{ color: trackColor }}>
                      {session._count?.drivers || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">pilotes</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune session enregistrée</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SpecCard({ icon, label, value, color }) {
  return (
    <div className="p-3 rounded-lg bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm text-center">
      <div className="flex items-center justify-center mb-1" style={{ color }}>
        {icon}
      </div>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-1">{label}</div>
      <div className="text-xl font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  )
}
