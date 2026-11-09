import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '../components/ui/Modal'
import { RecordsList } from '../components/RecordDisplays'
import { DriverFormModal } from './Drivers'
import DriverIdentity from '../components/driver/DriverIdentity'
import DriverProfileActions from '../components/driver/DriverProfileActions'
import DriverRecentSessions from '../components/driver/DriverRecentSessions'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function DriverProfile() {
  const { t } = useTranslation('drivers')
  const { id } = useParams()
  const navigate = useNavigate()
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [teams, setTeams] = useState([])

  useEffect(() => {
    loadDriver()
    fetch(`${API_URL}/api/teams`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTeams(d.data || [])
      })
      .catch(() => {})
  }, [id])

  async function loadDriver() {
    try {
      const res = await fetch(`${API_URL}/api/drivers/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setDriver(data.data)
    } catch (error) {
      console.error('Failed to load driver:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetStats() {
    setShowResetConfirm(false)
    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/api/drivers/${id}/reset-stats`, { method: 'POST' })
      if (res.ok) loadDriver()
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

  if (!driver) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate('/drivers')}>
          <ArrowLeft className="size-4" /> {t('common:back')}
        </Button>
        <p className="text-center text-muted-foreground mt-8">{t('profile.notFound')}</p>
      </div>
    )
  }

  // Deleting from the profile: the entity is soft-deleted, then we leave the page
  async function handleDelete() {
    try {
      await fetch(`${API_URL}/api/drivers/${driver.id}`, { method: 'DELETE' })
    } finally {
      navigate('/drivers')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        data-testid="driver-profile-header"
        className="border-b px-4 py-3 flex flex-wrap gap-3 items-center justify-between"
      >
        <div className="basis-full sm:basis-auto sm:flex-1 min-w-0 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/drivers')}>
            <ArrowLeft className="size-4" />
          </Button>
          <DriverIdentity driver={driver} />
        </div>
        <DriverProfileActions
          driver={driver}
          resetting={resetting}
          onEdit={() => setShowEdit(true)}
          onResetStats={() => setShowResetConfirm(true)}
          onDelete={handleDelete}
        />
      </div>

      {showEdit && (
        <DriverFormModal
          driver={driver}
          teams={teams}
          onClose={() => {
            setShowEdit(false)
            loadDriver()
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Records */}
          <RecordsList
            title={t('common:topRecords')}
            records={driver.records?.map((r) => ({
              ...r,
              driver: { name: driver.name, color: driver.color, img: driver.img },
            }))}
            showDriverAvatar={false}
            showCarAvatar={true}
            showCar={true}
            showTrack={true}
          />

          <DriverRecentSessions driver={driver} />
        </div>
      </div>
    </div>
  )
}
