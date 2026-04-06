import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Users2, Trophy, Clock, Play, MapPin, CheckCircle } from 'lucide-react'
import SessionForm from '../components/SessionForm'
import { ListPage } from '@/components/ui/list-page'
import { FilterHeader } from '@/components/ui/filter-header'
import { Badge } from '@/components/ui/badge'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function SessionsList() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)

  // Filter options
  const [tracks, setTracks] = useState([])
  const [championships, setChampionships] = useState([])

  const [filters, setFilters] = useState({
    status: [],
    trackId: [],
    type: [],
    championshipId: [],
    deleted: false,
  })
  const [sort, setSort] = useState(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/tracks`).then(r => r.json()),
      fetch(`${API_URL}/api/championships`).then(r => r.json()),
    ]).then(([tracksData, champsData]) => {
      if (tracksData.success) setTracks(tracksData.data || [])
      if (champsData.success) setChampionships(champsData.data || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadData(0)
  }, [filters, sort])

  const hasLoadedOnce = useRef(false)

  async function loadData(offset) {
    const isFirst = offset === 0
    if (isFirst && !hasLoadedOnce.current) setLoading(true)
    else if (!isFirst) setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (filters.status.length) params.append('status', filters.status.join(','))
      if (filters.trackId.length) params.append('trackId', filters.trackId.join(','))
      if (filters.type.length) params.append('type', filters.type.join(','))
      if (filters.championshipId.length) params.append('championshipId', filters.championshipId.join(','))
      if (filters.deleted) params.append('deleted', 'true')
      if (sort) {
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }
      params.append('offset', String(offset))
      params.append('limit', '50')
      const res = await fetch(`${API_URL}/api/sessions?${params}`)
      const data = await res.json()
      if (data.success) {
        setSessions(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      if (isFirst) { setLoading(false); hasLoadedOnce.current = true }
      else setLoadingMore(false)
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4 text-gray-500" />
      case 'active': return <Play className="h-4 w-4 text-green-500 animate-pulse" />
      case 'finished': return <CheckCircle className="h-4 w-4 text-blue-500" />
      default: return null
    }
  }

  function formatDate(date) {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatDuration(startedAt, finishedAt) {
    if (!startedAt || !finishedAt) return '-'
    const d = new Date(finishedAt) - new Date(startedAt)
    return `${Math.floor(d / 60000)}:${String(Math.floor((d % 60000) / 1000)).padStart(2, '0')}`
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Nom',
      cell: ({ row }) => (
        <div>
          <span className="font-semibold">
            {row.original.name || `Session #${row.original.id.slice(0, 8)}`}
          </span>
          {row.original.championship && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Trophy className="h-3 w-3 text-yellow-500" />
              {row.original.championship.name}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      accessorFn: (row) => row.type,
      meta: { label: 'Type' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Type"
          active={filtersRef.current.type.length > 0}
          value={filtersRef.current.type}
          options={[
            { value: 'practice', label: 'Essais libres' },
            { value: 'qualif', label: 'Qualifications' },
            { value: 'race', label: 'Course' },
          ]}
          onChange={(v) => setFilters(f => ({ ...f, type: v }))}
        />
      ),
      cell: ({ row }) => {
        const colors = {
          practice: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
          qualif: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
          race: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
        }
        const labels = { practice: 'Essais', qualif: 'Qualif', race: 'Course' }
        return (
          <Badge className={colors[row.original.type] || ''}>
            {labels[row.original.type] || row.original.type}
          </Badge>
        )
      },
    },
    {
      id: 'track',
      accessorFn: (row) => row.track?.name || '',
      meta: { label: 'Circuit' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Circuit"
          active={filtersRef.current.trackId.length > 0}
          value={filtersRef.current.trackId}
          options={tracks.map(t => ({ value: t.id, label: t.name }))}
          onChange={(v) => setFilters(f => ({ ...f, trackId: v }))}
        />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {row.original.track?.name || 'Non défini'}
        </span>
      ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.status,
      meta: { label: 'Statut' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Statut"
          active={filtersRef.current.status.length > 0}
          value={filtersRef.current.status}
          options={[
            { value: 'draft', label: 'Brouillon' },
            { value: 'active', label: 'En cours' },
            { value: 'finished', label: 'Terminée' },
          ]}
          onChange={(v) => setFilters(f => ({ ...f, status: v }))}
        />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {getStatusIcon(row.original.status)}
          <span className="text-muted-foreground">
            {{ draft: 'Brouillon', active: 'En cours', finished: 'Terminée' }[row.original.status] || row.original.status}
          </span>
        </span>
      ),
    },
    {
      id: 'championship',
      accessorFn: (row) => row.championship?.name || '',
      meta: { label: 'Championnat' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Championnat"
          active={filtersRef.current.championshipId.length > 0}
          value={filtersRef.current.championshipId}
          options={[
            { value: 'null', label: 'Hors championnat' },
            ...championships.map(c => ({ value: c.id, label: c.name })),
          ]}
          onChange={(v) => setFilters(f => ({ ...f, championshipId: v }))}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.championship?.name || '-'}
        </span>
      ),
    },
    {
      id: 'drivers',
      accessorFn: (row) => row.drivers?.length || 0,
      header: 'Pilotes',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users2 className="w-4 h-4" />
          {row.original.drivers?.length || 0}
        </span>
      ),
    },
    {
      id: 'laps',
      accessorFn: (row) => row._count?.laps || 0,
      header: 'Tours',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Flag className="w-4 h-4" />
          {row.original._count?.laps || 0}
        </span>
      ),
    },
    {
      id: 'duration',
      accessorFn: (row) => row.startedAt && row.finishedAt ? new Date(row.finishedAt) - new Date(row.startedAt) : 0,
      header: 'Durée',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDuration(row.original.startedAt, row.original.finishedAt)}
        </span>
      ),
    },
    {
      id: 'date',
      accessorFn: (row) => row.createdAt,
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
  ], [tracks, championships])

  const hasActiveFilters = filters.status.length > 0 || filters.trackId.length > 0 || filters.type.length > 0 || filters.championshipId.length > 0 || filters.deleted

  return (
    <ListPage
      title="Sessions"
      icon={<Flag />}
      color="indigo"
      preferenceKey="sessions"
      data={sessions}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder="Rechercher une session..."
      addLabel="Nouvelle session"
      onAdd={() => setShowForm(true)}
      onRowClick={(row) => !filters.deleted && navigate(`/sessions/${row.id}`)}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      deleteEndpoint="/api/sessions"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(sessions.length)}
      onSortChange={setSort}
      hasActiveFilters={hasActiveFilters}
      emptyTitle="Aucune session"
      emptyMessage="Créez votre première session"
      options={[
        {
          key: 'deleted',
          label: 'Afficher les supprimées',
          checked: filters.deleted,
          onChange: (v) => setFilters(f => ({ ...f, deleted: !!v })),
        },
      ]}
    >
      {showForm && (
        <SessionForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(0) }}
        />
      )}
    </ListPage>
  )
}
