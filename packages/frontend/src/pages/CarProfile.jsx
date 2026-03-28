import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Zap, Flame, FlaskConical, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecordsList } from '../components/RecordDisplays'
import { CarFormModal } from './Cars'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function CarProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [car, setCar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    loadCar()
  }, [id])

  async function loadCar() {
    try {
      const res = await fetch(`${API_URL}/api/cars/${id}`)
      if (!res.ok) {
        console.error('Failed to load car: HTTP', res.status)
        return
      }
      const data = await res.json()
      setCar(data.data)
    } catch (error) {
      console.error('Failed to load car:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetStats() {
    if (!confirm('Remettre à zéro toutes les statistiques de cette voiture ?')) return

    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/api/cars/${id}/reset-stats`, { method: 'POST' })
      if (res.ok) {
        loadCar()
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!car) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">Voiture non trouvée</p>
          <button
            onClick={() => navigate('/cars')}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Retour aux voitures
          </button>
        </div>
      </div>
    )
  }

  const carColor = car.color || '#22C55E'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/cars')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Retour aux voitures</span>
        </button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="size-4" />
            Modifier
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetStats} disabled={resetting} className="text-orange-600 dark:text-orange-400">
            <RefreshCw className={`size-4 ${resetting ? 'animate-spin' : ''}`} />
            Reset stats
          </Button>
        </div>
      </div>

      {showEdit && (
        <CarFormModal car={car} onClose={() => { setShowEdit(false); loadCar() }} />
      )}

      {/* Car Header */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${carColor}20 0%, ${carColor}05 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${carColor}, ${carColor} 10px, transparent 10px, transparent 20px)`
          }}
        />

        <div className="relative p-8">
          <div className="flex items-start gap-6">
            {/* Car image */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-2xl blur-xl opacity-50"
                style={{ backgroundColor: carColor }}
              />
              <div
                className="relative w-32 h-32 rounded-2xl flex items-center justify-center text-white font-black text-5xl ring-4 ring-white shadow-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${carColor} 0%, ${carColor}CC 100%)`,
                }}
              >
                {car.img ? (
                  <img
                    src={car.img}
                    alt={`${car.brand} ${car.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="drop-shadow-lg">{car.brand.charAt(0)}</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              {car.year && (
                <div
                  className="inline-block px-4 py-1 rounded-full text-sm font-bold text-white shadow-md mb-3"
                  style={{ backgroundColor: carColor }}
                >
                  {car.year}
                </div>
              )}

              <h1
                className="font-black text-4xl tracking-tight mb-1"
                style={{ color: carColor }}
              >
                {car.brand.toUpperCase()}
              </h1>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{car.model}</p>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <SpecCard
                  icon={<Zap className="w-5 h-5" />}
                  label="Vitesse"
                  value={`${car.maxSpeed}%`}
                  color="#22C55E"
                />
                <SpecCard
                  icon={<Flame className="w-5 h-5" />}
                  label="Freinage"
                  value={`${car.brakeForce}%`}
                  color="#EF4444"
                />
                <SpecCard
                  icon={<FlaskConical className="w-5 h-5" />}
                  label="Réservoir"
                  value={car.fuelCapacity}
                  color="#3B82F6"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute top-0 left-0 w-2 h-full"
          style={{ backgroundColor: carColor }}
        />
      </div>

      {/* Records & Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Records */}
        <RecordsList
          title="Top 10 Records"
          records={car.records}
          primaryColor={carColor}
          showDriverAvatar={true}
          showCarAvatar={false}
          showCar={false}
          showTrack={true}
        />

        {/* Recent Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sessions récentes</h2>
          {car.sessions && car.sessions.length > 0 ? (
            <div className="space-y-3">
              {car.sessions.slice(0, 5).map((sessionDriver) => (
                <div
                  key={sessionDriver.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {sessionDriver.session?.track?.name || 'Circuit inconnu'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {sessionDriver.session?.type === 'race' ? 'Course' :
                       sessionDriver.session?.type === 'qualif' ? 'Qualifications' :
                       'Essais'}
                    </div>
                  </div>
                  {sessionDriver.finalPos && (
                    <div className="text-right">
                      <div className="text-2xl font-black" style={{ color: carColor }}>
                        P{sessionDriver.finalPos}
                      </div>
                    </div>
                  )}
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
