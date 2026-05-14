import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '../components/ui/Modal'
import { RecordsList } from '../components/RecordDisplays'
import { DriverFormModal } from './Drivers'
import LapTime from '../components/race/LapTime'
import { getImgUrl } from '../utils/image'
import { sessionBadgeClass } from '@/lib/colors'

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
    fetch(`${API_URL}/api/teams`).then(r => r.json()).then(d => {
      if (d.success) setTeams(d.data || [])
    }).catch(() => {})
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

  const driverColor = driver.color || '#3B82F6'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/drivers')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div
            className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-bold ring-2 ring-offset-2 ring-offset-background"
            style={{ backgroundColor: driverColor, '--tw-ring-color': driverColor }}
          >
            {driver.img ? (
              <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
            ) : (
              <span>{driver.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg" style={{ color: driverColor }}>{driver.name}</h1>
              {driver.number && (
                <span className="text-sm font-black italic text-muted-foreground">#{driver.number}</span>
              )}
              {driver.team && (
                <Badge variant="secondary" style={{ backgroundColor: `${driver.team.color || driverColor}20`, color: driver.team.color || driverColor }}>
                  {driver.team.name}
                </Badge>
              )}
            </div>
            <div className="text-xs flex items-center gap-3">
              <span className="text-blue-500 font-medium">{driver._count?.sessions || 0} {t('glossary:race', { count: driver._count?.sessions || 0 })}</span>
              <span className="text-yellow-500 font-medium">{driver.wins || 0} {t('glossary:win', { count: driver.wins || 0 })}</span>
              <span className="text-orange-400 font-medium">{driver.podiums || 0} {t('glossary:podium', { count: driver.podiums || 0 })}</span>
              <span className="text-muted-foreground font-medium">{driver._count?.laps || 0} {t('glossary:lap', { count: driver._count?.laps || 0 })}</span>
              {driver.bestLap && (
                <span className="flex items-center gap-1">{t('common:record')} <LapTime time={driver.bestLap} size="sm" /></span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)} disabled={resetting} className="text-orange-600 dark:text-orange-400">
            <RefreshCw className={`size-4 ${resetting ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {showEdit && (
        <DriverFormModal driver={driver} teams={teams} onClose={() => { setShowEdit(false); loadDriver() }} />
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
            records={driver.records?.map(r => ({
              ...r,
              driver: { name: driver.name, color: driver.color, img: driver.img }
            }))}
            showDriverAvatar={false}
            showCarAvatar={true}
            showCar={true}
            showTrack={true}
          />

          {/* Recent Sessions */}
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">{t('common:recentSessions')}</h3>
              </div>
              {driver.sessions?.length > 0 ? (
                <div className="divide-y divide-border">
                  {driver.sessions.slice(0, 8).map((sd) => (
                    <Link
                      key={sd.id}
                      to={`/sessions/${sd.session?.id || sd.sessionId}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${sessionBadgeClass(sd.session?.type)}`}>
                          {sd.session?.type
                            ? t(`glossary:sessionType.${sd.session.type}`, { defaultValue: sd.session.type })
                            : ''}
                        </Badge>
                        <span className="text-sm text-foreground truncate">
                          {sd.session?.track?.name || t('common:unknownTrack')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {sd.finalPos && (
                          <span className="font-black text-base" style={{ color: driverColor }}>P{sd.finalPos}</span>
                        )}
                        {sd.bestLapTime && <LapTime time={sd.bestLapTime} size="sm" />}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t('common:noSessions')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
