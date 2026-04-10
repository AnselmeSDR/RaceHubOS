import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Pencil, Zap, Flame, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RecordsList } from '../components/RecordDisplays'
import { CarFormModal } from './Cars'
import LapTime from '../components/race/LapTime'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

const TYPE_LABELS = {
  practice: 'Essais',
  qualif: 'Qualif',
  race: 'Course',
  balancing: 'Équilibrage',
}

const TYPE_COLORS = {
  practice: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  qualif: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  race: 'bg-green-500/10 text-green-600 dark:text-green-400',
  balancing: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export default function CarProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [car, setCar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => { loadCar() }, [id])

  async function loadCar() {
    try {
      const res = await fetch(`${API_URL}/api/cars/${id}`)
      if (!res.ok) return
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
      if (res.ok) loadCar()
    } catch (error) {
      console.error('Failed to reset stats:', error)
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!car) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate('/cars')}>
          <ArrowLeft className="size-4" /> Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Voiture non trouvée</p>
      </div>
    )
  }

  const carColor = car.color || '#22C55E'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cars')}>
            <ArrowLeft className="size-4" />
          </Button>
          {car.img ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-offset-2 ring-offset-background" style={{ '--tw-ring-color': carColor }}>
              <img src={getImgUrl(car.img)} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: carColor }}>
              {car.brand.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg" style={{ color: carColor }}>{car.brand} {car.model}</h1>
              {car.year && <span className="text-sm text-muted-foreground">{car.year}</span>}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span className="flex items-center gap-1"><Zap className="size-3 text-green-500" />{car.maxSpeed}%</span>
              <span className="flex items-center gap-1"><Flame className="size-3 text-red-500" />{car.brakeForce}%</span>
              <span className="flex items-center gap-1"><FlaskConical className="size-3 text-blue-500" />{car.fuelCapacity}</span>
              <span>{car._count?.sessions || 0} sessions</span>
              {car.bestLap && (
                <span className="flex items-center gap-1">Record <LapTime time={car.bestLap} size="sm" /></span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetStats} disabled={resetting} className="text-orange-600 dark:text-orange-400">
            <RefreshCw className={`size-4 ${resetting ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {showEdit && (
        <CarFormModal car={car} onClose={() => { setShowEdit(false); loadCar() }} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Records */}
          <RecordsList
            title="Top 10 Records"
            records={car.records}
            showDriverAvatar={true}
            showCarAvatar={false}
            showCar={false}
            showTrack={true}
          />

          {/* Recent Sessions */}
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Sessions récentes</h3>
              </div>
              {car.sessions?.length > 0 ? (
                <div className="divide-y divide-border">
                  {car.sessions.slice(0, 8).map((sd) => (
                    <Link
                      key={sd.id}
                      to={`/sessions/${sd.session?.id || sd.sessionId}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[sd.session?.type] || ''}`}>
                          {TYPE_LABELS[sd.session?.type] || sd.session?.type}
                        </Badge>
                        <span className="text-sm text-foreground truncate">
                          {sd.session?.track?.name || 'Circuit inconnu'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {sd.finalPos && (
                          <span className="font-black text-base" style={{ color: carColor }}>P{sd.finalPos}</span>
                        )}
                        {sd.bestLapTime && <LapTime time={sd.bestLapTime} size="sm" />}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Aucune session
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
