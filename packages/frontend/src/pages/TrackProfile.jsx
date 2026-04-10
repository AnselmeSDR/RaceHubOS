import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Flag, MapPin, Trophy, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RecordsList } from '../components/RecordDisplays'
import { TrackFormModal } from './Tracks'
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
  practice: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  qualif: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  race: 'bg-green-500/10 text-green-600 dark:text-green-400',
  balancing: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export default function TrackProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => { loadTrack() }, [id])

  async function loadTrack() {
    try {
      const res = await fetch(`${API_URL}/api/tracks/${id}`)
      if (!res.ok) return
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
      if (res.ok) loadTrack()
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

  if (!track) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate('/tracks')}>
          <ArrowLeft className="size-4" /> Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Circuit non trouvé</p>
      </div>
    )
  }

  const trackColor = track.color || '#9333EA'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/tracks')}>
            <ArrowLeft className="size-4" />
          </Button>
          {track.img ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-offset-2 ring-offset-background" style={{ '--tw-ring-color': trackColor }}>
              <img src={getImgUrl(track.img)} alt={track.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: trackColor }}>
              <MapPin className="size-5" />
            </div>
          )}
          <div>
            <h1 className="font-black text-lg" style={{ color: trackColor }}>{track.name}</h1>
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              {track.length && <span>{track.length}m</span>}
              {track.corners && <span>{track.corners} virages</span>}
              <span>{track._count?.sessions || 0} sessions</span>
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
        <TrackFormModal track={track} onClose={() => { setShowEdit(false); loadTrack() }} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Record */}
        {track.bestLap && (
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <Trophy className="size-8 text-yellow-500 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground uppercase font-medium">Record du circuit</div>
                <LapTime time={track.bestLap} size="xl" highlight />
                {track.bestLapBy && (
                  <div className="text-sm text-muted-foreground mt-0.5">par {track.bestLapBy}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Records */}
          <RecordsList
            title="Top 10 Records"
            records={track.records}
            showDriverAvatar={true}
            showCarAvatar={true}
            showCar={true}
            showTrack={false}
          />

          {/* Recent Sessions */}
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Sessions récentes</h3>
              </div>
              {track.sessions?.length > 0 ? (
                <div className="divide-y divide-border">
                  {track.sessions.slice(0, 8).map((session) => (
                    <Link
                      key={session.id}
                      to={`/sessions/${session.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[session.type] || ''}`}>
                          {TYPE_LABELS[session.type] || session.type}
                        </Badge>
                        <span className="text-sm text-foreground">
                          {session.name || TYPE_LABELS[session.type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{session._count?.drivers || 0} pilotes</span>
                        <span>{new Date(session.createdAt).toLocaleDateString('fr-FR')}</span>
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
