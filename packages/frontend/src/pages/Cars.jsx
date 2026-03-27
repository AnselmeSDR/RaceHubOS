import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { TruckIcon, FlagIcon, BoltIcon, FireIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '../components/crud'
import { ListPage } from '@/components/ui/list-page'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

function RangeField({ label, value, onChange, min = 0, max = 100, color }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: color }} />
        <span className="text-sm font-medium w-10 text-right">{value}%</span>
      </div>
    </div>
  )
}

export default function Cars() {
  const navigate = useNavigate()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingCar, setEditingCar] = useState(null)
  const [sort, setSort] = useState(null)
  const [filters, setFilters] = useState({ deleted: false })

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
      const res = await fetch(`${API_URL}/api/cars?${params}`)
      const data = await res.json()
      if (data.success) {
        setCars(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load cars:', err)
    } finally {
      if (isFirst) { setLoading(false); hasLoadedOnce.current = true }
      else setLoadingMore(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'brand',
      header: 'Marque',
      cell: ({ row }) => <span className="font-semibold">{row.original.brand}</span>,
    },
    {
      accessorKey: 'model',
      header: 'Modèle',
      cell: ({ row }) => {
        const car = row.original
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white overflow-hidden flex-shrink-0"
              style={{ backgroundColor: car.color || '#22C55E' }}
            >
              {car.img ? (
                <img src={getImgUrl(car.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                car.brand?.charAt(0)
              )}
            </div>
            <span className="font-medium">{car.model}</span>
          </div>
        )
      },
    },
    {
      id: 'year',
      accessorKey: 'year',
      header: 'Année',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.year || '-'}</span>,
    },
    {
      id: 'maxSpeed',
      accessorKey: 'maxSpeed',
      header: 'Vitesse',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-2 w-20">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${row.original.maxSpeed}%` }} />
          </div>
          <span className="text-muted-foreground w-10 text-right">{row.original.maxSpeed}%</span>
        </div>
      ),
    },
    {
      id: 'brakeForce',
      accessorKey: 'brakeForce',
      header: 'Freinage',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-2 w-20">
            <div className="bg-red-500 h-2 rounded-full" style={{ width: `${row.original.brakeForce}%` }} />
          </div>
          <span className="text-muted-foreground w-10 text-right">{row.original.brakeForce}%</span>
        </div>
      ),
    },
    {
      id: 'fuelCapacity',
      accessorKey: 'fuelCapacity',
      header: 'Carburant',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.fuelCapacity}</span>,
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
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: 'Sessions',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <FlagIcon className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
  ], [])

  return (
    <ListPage
      title="Voitures"
      icon={<TruckIcon />}
      color="green"
      preferenceKey="cars"
      data={cars}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder="Rechercher une voiture..."
      addLabel="Nouvelle voiture"
      onAdd={() => { setEditingCar(null); setShowForm(true) }}
      onRowClick={(row) => !filters.deleted && navigate(`/cars/${row.id}`)}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((car) => (
            <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />
          ))}
        </div>
      )}
      deleteEndpoint="/api/cars"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(cars.length)}
      onSortChange={setSort}
      hasActiveFilters={filters.deleted}
      emptyTitle="Aucune voiture"
      emptyMessage="Ajoutez votre première voiture"
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
        <CarFormModal
          car={editingCar}
          onClose={() => { setShowForm(false); setEditingCar(null); loadData(0) }}
        />
      )}
    </ListPage>
  )
}

function CarCard({ car, onClick }) {
  const carColor = car.color || '#22C55E'

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
      style={{ background: `linear-gradient(135deg, ${carColor}10 0%, ${carColor}05 100%)` }}
    >
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: carColor }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: carColor }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${carColor} 0%, ${carColor}CC 100%)` }}
            >
              {car.img ? (
                <img src={getImgUrl(car.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{car.brand?.charAt(0)}</span>
              )}
            </div>
          </div>
          {car.year && (
            <Badge variant="secondary" className="shadow-md">{car.year}</Badge>
          )}
        </div>
        <h3 className="font-black text-xl tracking-tight text-foreground uppercase">{car.brand}</h3>
        <p className="font-bold text-lg" style={{ color: carColor }}>{car.model}</p>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: carColor }} />
      </div>

      <div className="relative px-6 pb-6 space-y-3">
        {[
          { icon: <BoltIcon className="w-4 h-4" />, label: 'Vitesse', value: car.maxSpeed, color: '#22C55E' },
          { icon: <FireIcon className="w-4 h-4" />, label: 'Freinage', value: car.brakeForce, color: '#EF4444' },
          { icon: <BeakerIcon className="w-4 h-4" />, label: 'Réservoir', value: (car.fuelCapacity / 150) * 100, color: '#3B82F6', display: car.fuelCapacity },
        ].map((spec) => (
          <div key={spec.label} className="flex items-center justify-between p-2 bg-card/60 rounded-lg">
            <div className="flex items-center gap-2">
              <span style={{ color: spec.color }}>{spec.icon}</span>
              <span className="text-xs font-medium text-muted-foreground uppercase">{spec.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 bg-muted rounded-full h-2">
                <div className="h-2 rounded-full" style={{ width: `${Math.min(spec.value, 100)}%`, backgroundColor: spec.color }} />
              </div>
              <span className="text-sm font-black w-10 text-right" style={{ color: spec.color }}>{spec.display ?? spec.value}%</span>
            </div>
          </div>
        ))}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">Courses</span>
            <span className="text-lg font-black" style={{ color: carColor }}>{car._count?.sessions || 0}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

function CarFormModal({ car, onClose }) {
  const [formData, setFormData] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year || new Date().getFullYear(),
    color: car?.color || '#22C55E',
    maxSpeed: car?.maxSpeed || 100,
    brakeForce: car?.brakeForce || 50,
    fuelCapacity: car?.fuelCapacity || 100,
    img: car?.img || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = car ? `${API_URL}/api/cars/${car.id}` : `${API_URL}/api/cars`
      const res = await fetch(url, {
        method: car ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setSuccess('Voiture sauvegardée')
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
      title={car ? 'Modifier la voiture' : 'Nouvelle voiture'}
      icon={<TruckIcon className="w-5 h-5 text-green-500" />}
      onSubmit={handleSubmit}
      isEditing={!!car}
      saving={saving}
      error={error}
      success={success}
      primaryColor="#22C55E"
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Marque" value={formData.brand} onChange={(v) => setFormData(f => ({ ...f, brand: v }))} placeholder="Ferrari" required />
        <TextField label="Modèle" value={formData.model} onChange={(v) => setFormData(f => ({ ...f, model: v }))} placeholder="SF-23" required />
      </div>
      <TextField label="Année" type="number" value={formData.year} onChange={(v) => setFormData(f => ({ ...f, year: parseInt(v) || new Date().getFullYear() }))} />
      <PhotoUploadField label="Photo" value={formData.img} onChange={(img) => setFormData(f => ({ ...f, img }))} shape="rect" primaryColor="#22C55E" onError={setError} uploadType="cars" />
      <ColorPickerField label="Couleur" value={formData.color} onChange={(color) => setFormData(f => ({ ...f, color }))} />
      <RangeField label="Vitesse max" value={formData.maxSpeed} onChange={(v) => setFormData(f => ({ ...f, maxSpeed: v }))} color="#22C55E" />
      <RangeField label="Force de freinage" value={formData.brakeForce} onChange={(v) => setFormData(f => ({ ...f, brakeForce: v }))} color="#EF4444" />
      <RangeField label="Capacité carburant" value={formData.fuelCapacity} onChange={(v) => setFormData(f => ({ ...f, fuelCapacity: v }))} color="#3B82F6" />
    </FormModal>
  )
}
