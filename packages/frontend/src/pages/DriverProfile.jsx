import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { DriverProfileHeader } from '../components/DriverDisplays'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function DriverProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDriver()
  }, [id])

  async function loadDriver() {
    try {
      const res = await fetch(`${API_URL}/drivers/${id}`)
      const data = await res.json()
      setDriver(data.data)
    } catch (error) {
      console.error('Failed to load driver:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Pilote non trouvé</p>
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
      {/* Back button */}
      <button
        onClick={() => navigate('/drivers')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        <span className="font-medium">Retour aux pilotes</span>
      </button>

      {/* Profile Header */}
      <DriverProfileHeader driver={driver} />

      {/* Recent sessions and more detailed stats could go here */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Sessions récentes</h2>
          {driver.sessions && driver.sessions.length > 0 ? (
            <div className="space-y-3">
              {driver.sessions.slice(0, 5).map((sessionDriver) => (
                <div
                  key={sessionDriver.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {sessionDriver.session.track?.name || 'Circuit inconnu'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {sessionDriver.session.type === 'race' ? 'Course' :
                       sessionDriver.session.type === 'qualifying' ? 'Qualifications' :
                       'Essais'}
                    </div>
                  </div>
                  {sessionDriver.finalPos && (
                    <div className="text-right">
                      <div className="text-2xl font-black" style={{ color: driver.color }}>
                        P{sessionDriver.finalPos}
                      </div>
                      <div className="text-xs text-gray-500">Position</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune session enregistrée</p>
          )}
        </div>

        {/* Best Laps */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Meilleurs tours</h2>
          {driver.laps && driver.laps.length > 0 ? (
            <div className="space-y-3">
              {driver.laps.map((lap, index) => (
                <div
                  key={lap.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white"
                      style={{ backgroundColor: driver.color }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        Tour {lap.lapNumber}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lap.sessionId ? `Session #${lap.sessionId.slice(-6)}` : 'Libre'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-xl font-black tabular-nums"
                      style={{ color: driver.color }}
                    >
                      {(lap.lapTime / 1000).toFixed(3)}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucun tour enregistré</p>
          )}
        </div>
      </div>
    </div>
  )
}
