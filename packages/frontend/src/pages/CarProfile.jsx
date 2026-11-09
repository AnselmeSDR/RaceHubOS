import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '../components/ui/Modal'
import { RecordsList } from '../components/RecordDisplays'
import { CarFormModal } from './Cars'
import CarSpecsCard from '../components/car/CarSpecsCard'
import CarIdentity from '../components/car/CarIdentity'
import CarProfileActions from '../components/car/CarProfileActions'
import CarRecentSessions from '../components/car/CarRecentSessions'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function CarProfile() {
  const { t } = useTranslation('cars')
  const { id } = useParams()
  const navigate = useNavigate()
  const [car, setCar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    loadCar()
  }, [id])

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
    setShowResetConfirm(false)
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
          <ArrowLeft className="size-4" /> {t('common:back')}
        </Button>
        <p className="text-center text-muted-foreground mt-8">{t('profile.notFound')}</p>
      </div>
    )
  }

  // Deleting from the profile: the entity is soft-deleted, then we leave the page
  async function handleDelete() {
    try {
      await fetch(`${API_URL}/api/cars/${car.id}`, { method: 'DELETE' })
    } finally {
      navigate('/cars')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cars')}>
            <ArrowLeft className="size-4" />
          </Button>
          <CarIdentity car={car} />
        </div>
        <CarProfileActions
          car={car}
          resetting={resetting}
          onEdit={() => setShowEdit(true)}
          onResetStats={() => setShowResetConfirm(true)}
          onDelete={handleDelete}
        />
      </div>

      {showEdit && (
        <CarFormModal
          car={car}
          onClose={() => {
            setShowEdit(false)
            loadCar()
          }}
        />
      )}

      <ConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetStats}
        title={t('common:resetStatsTitle')}
        message={t('profile.resetStatsMessage')}
        confirmLabel={t('common:reset')}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <CarSpecsCard car={car} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Records */}
          <RecordsList
            title={t('common:topRecords')}
            records={car.records}
            showDriverAvatar={true}
            showCarAvatar={false}
            showCar={false}
            showTrack={true}
          />

          <CarRecentSessions car={car} />
        </div>
      </div>
    </div>
  )
}
