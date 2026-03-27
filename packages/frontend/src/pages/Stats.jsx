import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartBarIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import { getImgUrl } from '../utils/image'
import { ListPage } from '@/components/ui/list-page'
import { FilterHeader } from '@/components/ui/filter-header'

const API_URL = import.meta.env.VITE_API_URL || ''

const sessionTypeLabels = {
  race: { label: 'Course', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  qualif: { label: 'Qualif', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  practice: { label: 'Essais', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

export default function Stats() {
  const navigate = useNavigate()
  const [laptimes, setLaptimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Filter options
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])

  const [filters, setFilters] = useState({
    driverId: [],
    carId: [],
    trackId: [],
    sessionType: [],
    unique: true,
  })
  const [sort, setSort] = useState(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/drivers`).then(r => r.json()),
      fetch(`${API_URL}/api/cars`).then(r => r.json()),
      fetch(`${API_URL}/api/tracks`).then(r => r.json()),
    ]).then(([d, c, t]) => {
      if (d.success) setDrivers(d.data || [])
      if (c.success) setCars(c.data || [])
      if (t.success) setTracks(t.data || [])
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
      if (filters.driverId.length) params.append('driverId', filters.driverId.join(','))
      if (filters.carId.length) params.append('carId', filters.carId.join(','))
      if (filters.trackId.length) params.append('trackId', filters.trackId.join(','))
      if (filters.sessionType.length) params.append('sessionType', filters.sessionType.join(','))
      params.append('unique', String(filters.unique))
      if (sort) {
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }
      params.append('limit', '50')
      params.append('offset', String(offset))
      const res = await fetch(`${API_URL}/api/stats/laptimes?${params}`)
      const data = await res.json()
      if (data.success) {
        setLaptimes(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load laptimes:', err)
    } finally {
      if (isFirst) { setLoading(false); hasLoadedOnce.current = true }
      else setLoadingMore(false)
    }
  }

  function formatTime(ms) {
    if (!ms) return '-'
    return (ms / 1000).toFixed(3) + 's'
  }

  const columns = useMemo(() => [
    {
      id: 'position',
      header: '#',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const index = row.index
        const isTop3 = index < 3
        if (isTop3) {
          return (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
            }`}>
              {index === 0 ? <TrophySolidIcon className="w-4 h-4" /> : index + 1}
            </div>
          )
        }
        return <span className="text-muted-foreground font-medium">{index + 1}</span>
      },
    },
    {
      id: 'lapTime',
      accessorKey: 'lapTime',
      header: 'Temps',
      cell: ({ row }) => {
        const isTop3 = row.index < 3
        return (
          <span className={`font-mono font-bold text-lg ${isTop3 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
            {formatTime(row.original.lapTime)}
          </span>
        )
      },
    },
    {
      id: 'driver',
      accessorFn: (row) => row.driver?.name || '',
      meta: { label: 'Pilote' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Pilote"
          active={filtersRef.current.driverId.length > 0}
          value={filtersRef.current.driverId}
          options={[
            ...drivers.map(d => ({ value: d.id, label: d.name })),
          ]}
          onChange={(v) => setFilters(f => ({ ...f, driverId: v }))}
        />
      ),
      cell: ({ row }) => {
        const driver = row.original.driver
        return (
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={(e) => { e.stopPropagation(); navigate(`/drivers/${driver?.id}`) }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: driver?.color || '#666' }}
            >
              {driver?.img ? (
                <img src={getImgUrl(driver.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                driver?.name?.charAt(0)
              )}
            </div>
            <span className="font-medium truncate">{driver?.name}</span>
          </div>
        )
      },
    },
    {
      id: 'car',
      accessorFn: (row) => `${row.car?.brand} ${row.car?.model}`,
      meta: { label: 'Voiture' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Voiture"
          active={filtersRef.current.carId.length > 0}
          value={filtersRef.current.carId}
          options={[
            ...cars.map(c => ({ value: c.id, label: `${c.brand} ${c.model}` })),
          ]}
          onChange={(v) => setFilters(f => ({ ...f, carId: v }))}
        />
      ),
      cell: ({ row }) => {
        const car = row.original.car
        return (
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={(e) => { e.stopPropagation(); navigate(`/cars/${car?.id}`) }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: car?.color || '#666' }}
            >
              {car?.img ? (
                <img src={getImgUrl(car.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                car?.brand?.charAt(0)
              )}
            </div>
            <span className="text-muted-foreground truncate">{car?.brand} {car?.model}</span>
          </div>
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
          options={[
            ...tracks.map(t => ({ value: t.id, label: t.name })),
          ]}
          onChange={(v) => setFilters(f => ({ ...f, trackId: v }))}
        />
      ),
      cell: ({ row }) => {
        const track = row.original.track
        return (
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={(e) => { e.stopPropagation(); navigate(`/tracks/${track?.id}`) }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: track?.color || '#666' }} />
            <span className="text-muted-foreground truncate">{track?.name}</span>
          </div>
        )
      },
    },
    {
      id: 'sessionType',
      accessorFn: (row) => row.sessionType,
      meta: { label: 'Session' },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label="Session"
          active={filtersRef.current.sessionType.length > 0}
          value={filtersRef.current.sessionType}
          options={[
            { value: 'practice', label: 'Essais' },
            { value: 'qualif', label: 'Qualifications' },
            { value: 'race', label: 'Course' },
          ]}
          onChange={(v) => setFilters(f => ({ ...f, sessionType: v }))}
        />
      ),
      cell: ({ row }) => {
        const info = sessionTypeLabels[row.original.sessionType] || sessionTypeLabels.practice
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${info.color}`}>
            {info.label}
          </span>
        )
      },
    },
    {
      id: 'date',
      accessorFn: (row) => row.sessionDate,
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.sessionDate ? new Date(row.original.sessionDate).toLocaleDateString('fr-FR') : '-'}
        </span>
      ),
    },
  ], [drivers, cars, tracks])

  const hasActiveFilters = filters.driverId.length > 0 || filters.carId.length > 0 || filters.trackId.length > 0 || filters.sessionType.length > 0

  return (
    <ListPage
      title="Statistiques & Records"
      icon={<ChartBarIcon />}
      color="indigo"
      preferenceKey="stats"
      data={laptimes}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder="Rechercher..."
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(laptimes.length)}
      onSortChange={setSort}
      hasActiveFilters={hasActiveFilters}
      emptyTitle="Aucun record"
      emptyMessage="Aucun temps enregistré"
      options={[
        {
          key: 'unique',
          label: 'Meilleur par pilote/voiture',
          checked: filters.unique,
          onChange: (v) => setFilters(f => ({ ...f, unique: !!v })),
        },
      ]}
    />
  )
}
