import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'
import { ListPage } from '@/components/ui/list-page'
import { EMPTY_LAP_FILTERS, hasLapFilters, lapFilterParams } from '../components/stats/lapFilters'
import { statsColumns } from '../components/stats/statsColumns'
import { StatsFilterContext } from '../components/stats/statsFilterContext'
import { usePagedList } from '../hooks/usePagedList'
import { getData, getReferenceData } from '../lib/sessionApi'
import { sessionTypeOptions } from '../utils/sessionTypes'

/** Every recorded lap, fastest first, filtered by driver, car, track, championship and session type. */
export default function Stats() {
  const { t, i18n } = useTranslation('stats')
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_LAP_FILTERS)
  const [lists, setLists] = useState({ drivers: [], cars: [], tracks: [], championships: [] })
  const list = usePagedList('/api/stats/laptimes', lapFilterParams(filters))

  useEffect(() => {
    Promise.all([getReferenceData(), getData('/api/championships')]).then(([reference, championships]) => {
      setLists((prev) => ({
        drivers: reference.drivers || prev.drivers,
        cars: reference.cars || prev.cars,
        tracks: reference.tracks || prev.tracks,
        championships: championships || prev.championships,
      }))
    })
  }, [])

  const filterContext = useMemo(
    () => ({
      filters,
      setFilter: (key, values) => setFilters((f) => ({ ...f, [key]: values })),
      options: {
        driverId: lists.drivers.map((d) => ({ value: d.id, label: d.name })),
        carId: lists.cars.map((c) => ({ value: c.id, label: `${c.brand} ${c.model}` })),
        trackId: lists.tracks.map((tr) => ({ value: tr.id, label: tr.name })),
        championshipId: [
          ...lists.championships.map((c) => ({ value: c.id, label: c.name })),
          { value: 'none', label: t('noChampionship') },
        ],
        sessionType: sessionTypeOptions(t),
      },
    }),
    [filters, lists, t]
  )

  const columns = useMemo(
    () => statsColumns(t, { lang: i18n.language, onOpen: navigate }),
    [t, i18n.language, navigate]
  )

  return (
    <StatsFilterContext.Provider value={filterContext}>
      <ListPage
        {...list.listProps}
        title={t('title')}
        icon={<BarChart3 />}
        color="indigo"
        preferenceKey="stats"
        columns={columns}
        searchPlaceholder={t('common:search')}
        hasActiveFilters={hasLapFilters(filters) || list.showDeleted}
        emptyTitle={t('emptyTitle')}
        emptyMessage={t('emptyMessage')}
        deleteEndpoint="/api/stats/laps"
        options={[
          {
            key: 'unique',
            label: t('options.bestPerDriverCar'),
            checked: filters.unique,
            onChange: (v) => setFilters((f) => ({ ...f, unique: !!v })),
          },
          ...list.listProps.options,
        ]}
      />
    </StatsFilterContext.Provider>
  )
}
