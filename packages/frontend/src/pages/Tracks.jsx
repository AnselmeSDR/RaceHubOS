import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPinIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '../components/crud'
import { ListPage } from '@/components/ui/list-page'
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
                <MapPinIcon className="w-4 h-4" />
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
          <RocketLaunchIcon className="w-4 h-4 text-purple-500" />
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
          <ArrowPathIcon className="w-4 h-4 text-purple-500" />
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
          <ClockIcon className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
  ], [])

  return (
    <ListPage
      title="Circuits"
      icon={<MapPinIcon />}
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

function TrackFormModal({ track, onClose }) {
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
      icon={<MapPinIcon className="w-5 h-5 text-purple-500" />}
      onSubmit={handleSubmit}
      isEditing={!!track}
      saving={saving}
      error={error}
      success={success}
      primaryColor="#9333EA"
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
        primaryColor="#9333EA"
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
