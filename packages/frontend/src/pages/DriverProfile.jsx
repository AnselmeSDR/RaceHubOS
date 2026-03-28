import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { DriverProfileHeader } from '../components/DriverDisplays'
import { RecordsList } from '../components/RecordDisplays'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PRIMARY_COLOR = '#3B82F6'

export default function DriverProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadDriver()
  }, [id])

  async function loadDriver() {
    try {
      const res = await fetch(`${API_URL}/drivers/${id}`)
      if (!res.ok) {
        console.error('Failed to load driver: HTTP', res.status)
        return
      }
      const data = await res.json()
      setDriver(data.data)
    } catch (error) {
      console.error('Failed to load driver:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetStats() {
    if (!confirm('Remettre à zéro toutes les statistiques de ce pilote ?')) return

    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/drivers/${id}/reset-stats`, { method: 'POST' })
      if (res.ok) {
        loadDriver()
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">Pilote non trouvé</p>
          <button
            onClick={() => navigate('/drivers')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour aux pilotes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header with back button and actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/drivers')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Retour aux pilotes</span>
        </button>

        <button
          onClick={handleResetStats}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
          Reset stats
        </button>
      </div>

      {/* Profile Header */}
      <DriverProfileHeader driver={driver} />

      {/* Recent sessions and more detailed stats could go here */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sessions récentes</h2>
          {driver.sessions && driver.sessions.length > 0 ? (
            <div className="space-y-3">
              {driver.sessions.slice(0, 5).map((sessionDriver) => (
                <div
                  key={sessionDriver.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {sessionDriver.session.track?.name || 'Circuit inconnu'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {sessionDriver.session.type === 'race' ? 'Course' :
                       sessionDriver.session.type === 'qualif' ? 'Qualifications' :
                       'Essais'}
                    </div>
                  </div>
                  {sessionDriver.finalPos && (
                    <div className="text-right">
                      <div className="text-2xl font-black" style={{ color: driver.color }}>
                        P{sessionDriver.finalPos}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Position</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune session enregistrée</p>
          )}
        </div>

        {/* Top 10 Records */}
        <RecordsList
          title="Top 10 Records"
          records={driver.records?.map(r => ({
            ...r,
            driver: { name: driver.name, color: driver.color, img: driver.img }
          }))}
          primaryColor={driver.color || PRIMARY_COLOR}
          showDriverAvatar={false}
          showCarAvatar={true}
          showCar={true}
          showTrack={true}
        />
      </div>
    </div>
  )
}
