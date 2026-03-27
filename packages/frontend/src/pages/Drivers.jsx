import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  TrophyIcon,
  FlagIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import { FormModal, TextField, SelectField, PhotoUploadField, ColorPickerField } from '../components/crud'
import { ListPage } from '@/components/ui/list-page'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Drivers() {
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)
  const [sort, setSort] = useState(null)
  const [filters, setFilters] = useState({ deleted: false })

  useEffect(() => {
    fetch(`${API_URL}/api/teams`).then(r => r.json()).then(d => {
      if (d.success) setTeams(d.data || [])
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
      if (filters.deleted) params.append('deleted', 'true')
      if (sort) {
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }
      params.append('offset', String(offset))
      params.append('limit', '50')
      const res = await fetch(`${API_URL}/api/drivers?${params}`)
      const data = await res.json()
      if (data.success) {
        setDrivers(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load drivers:', err)
    } finally {
      if (isFirst) { setLoading(false); hasLoadedOnce.current = true }
      else setLoadingMore(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Pilote',
      cell: ({ row }) => {
        const driver = row.original
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: driver.color || '#3B82F6' }}
            >
              {driver.img ? (
                <img src={getImgUrl(driver.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                driver.name?.charAt(0)
              )}
            </div>
            <span className="font-semibold">{driver.name}</span>
          </div>
        )
      },
    },
    {
      id: 'number',
      accessorKey: 'number',
      header: 'N°',
      cell: ({ row }) => (
        row.original.number
          ? <Badge className="bg-gray-100 dark:bg-gray-800 text-foreground font-mono font-bold">{row.original.number}</Badge>
          : <span className="text-muted-foreground">-</span>
      ),
    },
    {
      id: 'team',
      accessorFn: (row) => row.team?.name || '',
      header: 'Équipe',
      cell: ({ row }) => (
        row.original.team
          ? <Badge className="text-white shadow-sm" style={{ backgroundColor: row.original.team.color || row.original.color }}>{row.original.team.name}</Badge>
          : <span className="text-muted-foreground">-</span>
      ),
    },
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: 'Courses',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <FlagIcon className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
    {
      id: 'wins',
      accessorKey: 'wins',
      header: 'Victoires',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <TrophyIcon className="w-4 h-4 text-yellow-500" />
          {row.original.wins || 0}
        </span>
      ),
    },
    {
      id: 'podiums',
      accessorKey: 'podiums',
      header: 'Podiums',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.podiums || 0}</span>
      ),
    },
    {
      id: 'laps',
      accessorFn: (row) => row._count?.laps || 0,
      header: 'Tours',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ChartBarIcon className="w-4 h-4" />
          {row.original._count?.laps || 0}
        </span>
      ),
    },
    {
      id: 'bestLap',
      accessorFn: (row) => row.bestLap || Infinity,
      header: 'Record',
      cell: ({ row }) => (
        <span className="font-mono font-bold">
          {row.original.bestLap ? `${(row.original.bestLap / 1000).toFixed(3)}s` : '-'}
        </span>
      ),
    },
  ], [])

  return (
    <ListPage
      title="Pilotes"
      icon={<UserIcon />}
      color="blue"
      preferenceKey="drivers"
      data={drivers}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder="Rechercher un pilote..."
      addLabel="Nouveau pilote"
      onAdd={() => { setEditingDriver(null); setShowForm(true) }}
      onRowClick={(row) => !filters.deleted && navigate(`/drivers/${row.id}`)}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((driver) => (
            <DriverCard key={driver.id} driver={driver} onClick={() => navigate(`/drivers/${driver.id}`)} />
          ))}
        </div>
      )}
      deleteEndpoint="/api/drivers"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(drivers.length)}
      onSortChange={setSort}
      hasActiveFilters={filters.deleted}
      emptyTitle="Aucun pilote"
      emptyMessage="Ajoutez votre premier pilote"
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
        <DriverFormModal
          driver={editingDriver}
          teams={teams}
          onClose={() => { setShowForm(false); setEditingDriver(null); loadData(0) }}
        />
      )}
    </ListPage>
  )
}

function DriverCard({ driver, onClick }) {
  const wins = driver.wins || 0
  const podiums = driver.podiums || 0

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${driver.color}15 0%, ${driver.color}05 100%)`,
        boxShadow: `0 4px 6px rgba(0,0,0,0.1), 0 0 20px ${driver.color}40`
      }}
    >
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: driver.color }} />
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${driver.color}, ${driver.color} 10px, transparent 10px, transparent 20px)` }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-md opacity-50" style={{ backgroundColor: driver.color }} />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)` }}
            >
              {driver.img ? (
                <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{driver.name?.charAt(0)}</span>
              )}
            </div>
            {wins > 0 && (
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center ring-2 ring-white shadow-lg">
                <TrophySolidIcon className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {driver.number && (
              <div className="w-16 h-16 rounded-lg flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}DD 100%)` }}>
                <span className="text-4xl font-black text-white drop-shadow-lg">{driver.number}</span>
              </div>
            )}
            {driver.team && (
              <Badge className="text-white shadow-md" style={{ backgroundColor: driver.team.color || driver.color }}>
                {driver.team.name}
              </Badge>
            )}
          </div>
        </div>
        <h3 className="font-black text-2xl tracking-tight mb-1" style={{ color: driver.color }}>{driver.name?.toUpperCase()}</h3>
        <div className="h-1 w-16 rounded-full" style={{ backgroundColor: driver.color }} />
      </div>

      <div className="relative px-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <FlagIcon className="w-4 h-4" />, label: 'Courses', value: driver._count?.sessions || 0 },
            { icon: <TrophyIcon className="w-4 h-4" />, label: 'Podiums', value: podiums, highlight: podiums > 0 },
            { icon: <ChartBarIcon className="w-4 h-4" />, label: 'Tours', value: driver._count?.laps || 0 },
          ].map((stat) => (
            <div key={stat.label} className={`p-2 rounded-lg text-center ${stat.highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 ring-2 ring-yellow-400' : 'bg-card/60'}`}>
              <div className="flex items-center justify-center mb-1" style={{ color: stat.highlight ? '#EAB308' : driver.color }}>{stat.icon}</div>
              <div className="text-xs font-medium text-muted-foreground uppercase">{stat.label}</div>
              <div className="text-lg font-black tabular-nums" style={{ color: stat.highlight ? '#EAB308' : driver.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
        {driver.bestLap && (
          <div className="mt-3 p-3 rounded-lg bg-card/80 border-2" style={{ borderColor: `${driver.color}40` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase">Meilleur Tour</span>
              <span className="text-lg font-black tabular-nums" style={{ color: driver.color }}>{(driver.bestLap / 1000).toFixed(3)}s</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function DriverFormModal({ driver, teams, onClose }) {
  const [formData, setFormData] = useState({
    name: driver?.name || '',
    number: driver?.number || '',
    email: driver?.email || '',
    img: driver?.img || '',
    color: driver?.color || '#3B82F6',
    teamId: driver?.teamId || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = driver ? `${API_URL}/api/drivers/${driver.id}` : `${API_URL}/api/drivers`
      const res = await fetch(url, {
        method: driver ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setSuccess('Pilote sauvegardé')
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
      title={driver ? 'Modifier le pilote' : 'Nouveau pilote'}
      icon={<UserIcon className="w-5 h-5 text-blue-500" />}
      onSubmit={handleSubmit}
      isEditing={!!driver}
      saving={saving}
      error={error}
      success={success}
      primaryColor="#3B82F6"
    >
      <TextField label="Nom" value={formData.name} onChange={(v) => setFormData(f => ({ ...f, name: v }))} placeholder="Lewis Hamilton" required />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Numéro" type="number" value={formData.number} onChange={(v) => setFormData(f => ({ ...f, number: v ? parseInt(v) : '' }))} placeholder="44" />
        <TextField label="Email" type="email" value={formData.email} onChange={(v) => setFormData(f => ({ ...f, email: v }))} placeholder="lewis@example.com" />
      </div>
      <PhotoUploadField label="Photo" value={formData.img} onChange={(img) => setFormData(f => ({ ...f, img }))} shape="round" primaryColor="#3B82F6" onError={setError} uploadType="drivers" />
      <ColorPickerField label="Couleur" value={formData.color} onChange={(color) => setFormData(f => ({ ...f, color }))} />
      <SelectField label="Équipe" value={formData.teamId} onChange={(v) => setFormData(f => ({ ...f, teamId: v }))} options={teams.map(t => ({ value: t.id, label: t.name }))} placeholder="Aucune équipe" />
    </FormModal>
  )
}
