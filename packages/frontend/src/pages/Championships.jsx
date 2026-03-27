import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrophyIcon,
  MapPinIcon,
  FlagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { FormModal, TextField, SelectField } from '../components/crud'
import { ListPage } from '@/components/ui/list-page'
import { FilterHeader } from '@/components/ui/filter-header'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Championships() {
  const navigate = useNavigate()
  const [championships, setChampionships] = useState([])
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)

  const [filters, setFilters] = useState({
    trackId: [],
    status: [],
    deleted: false,
  })

  useEffect(() => {
    fetch(`${API_URL}/api/tracks`).then(r => r.json()).then(d => {
      if (d.success) setTracks(d.data || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadData(0)
  }, [filters])

  async function loadData(offset) {
    const isFirst = offset === 0
    if (isFirst) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (filters.trackId.length) params.append('trackId', filters.trackId.join(','))
      if (filters.status.length) params.append('status', filters.status.join(','))
      if (filters.deleted) params.append('deleted', 'true')
      params.append('offset', String(offset))
      params.append('limit', '50')
      const res = await fetch(`${API_URL}/api/championships?${params}`)
      const data = await res.json()
      if (data.success) {
        setChampionships(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load championships:', err)
    } finally {
      if (isFirst) setLoading(false)
      else setLoadingMore(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Nom',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrophyIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <span className="font-semibold">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: 'track',
      accessorFn: (row) => tracks.find(t => t.id === row.trackId)?.name || '',
      meta: { label: 'Circuit' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Circuit"
          active={filters.trackId.length > 0}
          value={filters.trackId}
          options={tracks.map(t => ({ value: t.id, label: t.name }))}
          onChange={(v) => setFilters(f => ({ ...f, trackId: v }))}
        />
      ),
      cell: ({ row }) => {
        const track = tracks.find(t => t.id === row.original.trackId)
        return (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPinIcon className="w-4 h-4" />
            {track?.name || 'Non défini'}
          </span>
        )
      },
    },
    {
      id: 'qualifs',
      accessorFn: (row) => row.sessions?.filter(s => s.type === 'qualif').length || 0,
      header: 'Qualifs',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ClockIcon className="w-4 h-4 text-blue-500" />
          {row.original.sessions?.filter(s => s.type === 'qualif').length || 0}
        </span>
      ),
    },
    {
      id: 'races',
      accessorFn: (row) => row.sessions?.filter(s => s.type === 'race').length || 0,
      header: 'Courses',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FlagIcon className="w-4 h-4 text-green-500" />
          {row.original.sessions?.filter(s => s.type === 'race').length || 0}
        </span>
      ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.status || 'planned',
      meta: { label: 'Statut' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Statut"
          active={filters.status.length > 0}
          value={filters.status}
          options={[
            { value: 'planned', label: 'Planifié' },
            { value: 'active', label: 'En cours' },
            { value: 'finished', label: 'Terminé' },
          ]}
          onChange={(v) => setFilters(f => ({ ...f, status: v }))}
        />
      ),
      cell: ({ row }) => {
        const styles = {
          active: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
          finished: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          planned: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
        }
        const labels = { active: 'En cours', finished: 'Terminé', planned: 'Planifié' }
        const key = row.original.status || 'planned'
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[key] || styles.planned}`}>
            {labels[key] || labels.planned}
          </span>
        )
      },
    },
  ], [filters, tracks])

  return (
    <ListPage
      title="Championnats"
      icon={<TrophyIcon />}
      color="yellow"
      preferenceKey="championships"
      data={championships}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder="Rechercher un championnat..."
      addLabel="Nouveau championnat"
      onAdd={() => setShowForm(true)}
      onRowClick={(row) => !filters.deleted && navigate(`/championships/${row.id}`)}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      deleteEndpoint="/api/championships"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(championships.length)}
      hasActiveFilters={filters.trackId.length > 0 || filters.status.length > 0 || filters.deleted}
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
        <ChampionshipFormModal
          tracks={tracks}
          onClose={() => { setShowForm(false); loadData(0) }}
        />
      )}
    </ListPage>
  )
}

function ChampionshipFormModal({ tracks, onClose }) {
  const [formData, setFormData] = useState({ name: '', trackId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    if (!formData.name || !formData.trackId) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/championships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          trackId: formData.trackId,
          season: new Date().getFullYear().toString(),
          pointsSystem: '{}'
        })
      })
      if (res.ok) {
        setSuccess('Championnat créé avec succès')
        setTimeout(() => onClose(), 1500)
      } else {
        setError('Erreur lors de la création')
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
      title="Nouveau championnat"
      icon={<TrophyIcon className="w-5 h-5 text-yellow-500" />}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
      success={success}
      primaryColor="#EAB308"
      saveLabel="Créer"
    >
      <TextField
        label="Nom du championnat"
        value={formData.name}
        onChange={(v) => setFormData(f => ({ ...f, name: v }))}
        placeholder="Championnat 2024"
        required
      />
      <SelectField
        label="Circuit"
        value={formData.trackId}
        onChange={(v) => setFormData(f => ({ ...f, trackId: v }))}
        options={tracks.map(t => ({ value: t.id, label: t.name }))}
        placeholder="Sélectionner un circuit..."
        required
      />
    </FormModal>
  )
}
