import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, RefreshCw, Rocket, Clock, Trophy, Pencil } from 'lucide-react'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '../components/crud'
import { ListPage } from '@/components/ui/list-page'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Tracks() {
  const navigate = useNavigate()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingTrack, setEditingTrack] = useState(null)

  const [filters, setFilters] = useState({ deleted: false })
  const [sort, setSort] = useState(null)

  useEffect(() => {
    loadData(0)
  }, [filters, sort])

  async function loadData(offset) {
    const isFirst = offset === 0
    if (isFirst) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (filters.deleted) params.append('deleted', 'true')
      if (sort) {
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }
      params.append('offset', String(offset))
      params.append('limit', '50')
      const res = await fetch(`${API_URL}/api/tracks?${params}`)
      const data = await res.json()
      if (data.success) {
        setTracks(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load tracks:', err)
    } finally {
      if (isFirst) setLoading(false)
      else setLoadingMore(false)
    }
  }

  function formatTime(ms) {
    if (!ms) return '-'
    return (ms / 1000).toFixed(3) + 's'
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Nom',
      cell: ({ row }) => {
        const track = row.original
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white overflow-hidden flex-shrink-0"
              style={{ backgroundColor: track.color || '#9333EA' }}
            >
              {track.img ? (
                <img src={getImgUrl(track.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>
            <span className="font-semibold">{track.name}</span>
          </div>
        )
      },
    },
    {
      id: 'length',
      accessorFn: (row) => row.length || 0,
      header: 'Longueur',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Rocket className="w-4 h-4 text-purple-500" />
          {row.original.length ? `${row.original.length}m` : '-'}
        </span>
      ),
    },
    {
      id: 'corners',
      accessorFn: (row) => row.corners || 0,
      header: 'Virages',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <RefreshCw className="w-4 h-4 text-purple-500" />
          {row.original.corners || '-'}
        </span>
      ),
    },
    {
      id: 'bestLap',
      accessorFn: (row) => row.bestLap || Infinity,
      header: 'Record',
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-bold">
            {formatTime(row.original.bestLap)}
          </span>
          {row.original.bestLapBy && (
            <span className="text-xs text-muted-foreground ml-1.5">
              par {row.original.bestLapBy}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: 'Sessions',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); setEditingTrack(row.original); setShowForm(true) }}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="size-3.5" />
        </button>
      ),
    },
  ], [])

  return (
    <ListPage
      title="Circuits"
      icon={<MapPin />}
      color="purple"
      preferenceKey="tracks"
      data={tracks}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder="Rechercher un circuit..."
      addLabel="Nouveau circuit"
      onAdd={() => { setEditingTrack(null); setShowForm(true) }}
      onRowClick={(row) => !filters.deleted && navigate(`/tracks/${row.id}`)}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      deleteEndpoint="/api/tracks"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(tracks.length)}
      onSortChange={setSort}
      hasActiveFilters={filters.deleted}
      emptyTitle="Aucun circuit"
      emptyMessage="Ajoutez votre premier circuit"
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((track) => (
            <TrackCard key={track.id} track={track} onClick={() => navigate(`/tracks/${track.id}`)} onEdit={() => { setEditingTrack(track); setShowForm(true) }} />
          ))}
        </div>
      )}
      options={[
        {
          key: 'deleted',
          label: 'Afficher les supprimés',
          checked: filters.deleted,
          onChange: (v) => setFilters(f => ({ ...f, deleted: !!v })),
        },
      ]}
    >
      {showForm && (
        <TrackFormModal
          track={editingTrack}
          onClose={() => { setShowForm(false); setEditingTrack(null); loadData(0) }}
        />
      )}
    </ListPage>
  )
}

function TrackCard({ track, onClick, onEdit }) {
  const trackColor = track.color || '#9333EA'

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
      style={{ background: `linear-gradient(135deg, ${trackColor}10 0%, ${trackColor}05 100%)` }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onEdit() }}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors"
      >
        <Pencil className="size-3.5" />
      </button>
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: trackColor }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: trackColor }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${trackColor} 0%, ${trackColor}CC 100%)` }}
            >
              {track.img ? (
                <img src={getImgUrl(track.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <MapPin className="w-10 h-10 drop-shadow-lg" />
              )}
            </div>
          </div>
          {track.bestLap && (
            <Badge className="bg-yellow-500 text-white shadow-md">
              <Trophy className="w-3 h-3" />
              Record
            </Badge>
          )}
        </div>
        <h3 className="font-black text-xl tracking-tight text-foreground uppercase">{track.name}</h3>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: trackColor }} />
      </div>

      <div className="relative px-6 pb-6 space-y-3">
        {track.length && (
          <div className="flex items-center justify-between p-2 bg-card/60 rounded-lg">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4" style={{ color: trackColor }} />
              <span className="text-xs font-medium text-muted-foreground uppercase">Longueur</span>
            </div>
            <span className="text-sm font-black" style={{ color: trackColor }}>{track.length}m</span>
          </div>
        )}
        {track.corners && (
          <div className="flex items-center justify-between p-2 bg-card/60 rounded-lg">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" style={{ color: trackColor }} />
              <span className="text-xs font-medium text-muted-foreground uppercase">Virages</span>
            </div>
            <span className="text-sm font-black" style={{ color: trackColor }}>{track.corners}</span>
          </div>
        )}
        {track.bestLap && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-bold text-yellow-900 dark:text-yellow-300 uppercase">Record</span>
              </div>
              <span className="text-lg font-black text-yellow-600 dark:text-yellow-400">{(track.bestLap / 1000).toFixed(3)}s</span>
            </div>
            {track.bestLapBy && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 text-right">par {track.bestLapBy}</div>
            )}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Courses</span>
            <span className="text-lg font-black" style={{ color: trackColor }}>{track._count?.sessions || 0}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function TrackFormModal({ track, onClose }) {
  const [formData, setFormData] = useState({
    name: track?.name || '',
    length: track?.length || '',
    corners: track?.corners || '',
    img: track?.img || '',
    color: track?.color || '#9333EA'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = track ? `${API_URL}/api/tracks/${track.id}` : `${API_URL}/api/tracks`
      const res = await fetch(url, {
        method: track ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          img: formData.img || null,
          length: formData.length ? parseFloat(formData.length) : null,
          corners: formData.corners ? parseInt(formData.corners) : null,
          color: formData.color
        })
      })
      if (res.ok) {
        setSuccess('Circuit sauvegardé')
        setTimeout(() => onClose(), 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onClose}
      title={track ? 'Modifier le circuit' : 'Nouveau circuit'}
      icon={<MapPin className="w-5 h-5 text-primary" />}
      onSubmit={handleSubmit}
      isEditing={!!track}
      saving={saving}
      error={error}
      success={success}
    >
      <TextField
        label="Nom"
        value={formData.name}
        onChange={(v) => setFormData(f => ({ ...f, name: v }))}
        placeholder="Monaco Grand Prix"
        required
      />
      <PhotoUploadField
        label="Photo du circuit"
        value={formData.img}
        onChange={(img) => setFormData(f => ({ ...f, img }))}
        shape="rect"
        onError={setError}
        uploadType="tracks"
      />
      <ColorPickerField
        label="Couleur"
        value={formData.color}
        onChange={(color) => setFormData(f => ({ ...f, color }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Longueur (m)"
          type="number"
          value={formData.length}
          onChange={(v) => setFormData(f => ({ ...f, length: v }))}
          placeholder="12.5"
        />
        <TextField
          label="Virages"
          type="number"
          value={formData.corners}
          onChange={(v) => setFormData(f => ({ ...f, corners: v }))}
          placeholder="18"
        />
      </div>
    </FormModal>
  )
}
