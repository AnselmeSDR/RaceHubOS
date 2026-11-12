import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import { ListPage } from '@/components/ui/list-page'
import { ColumnFilterContext } from '@/components/crud/columnFilterContext'
import { divisionFilterOptions } from '@/components/division/divisionFilterOptions'
import { useDivisions } from '@/hooks/useDivisions'
import { filterParams, hasColumnFilters } from '@/lib/listFilters'
import CarCard from '@/components/car/CarCard'
import CarFormModal from '@/components/car/CarFormModal'
import { carColumns } from '@/components/car/carColumns'
import { usePagedList } from '@/hooks/usePagedList'

const API_URL = import.meta.env.VITE_API_URL || ''
const EMPTY_FILTERS = { divisionId: [] }

/** Every car, filtered by category. */
export default function Cars() {
  const { t } = useTranslation('cars')
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const list = usePagedList('/api/cars', filterParams(filters))
  const categories = useDivisions(DivisionScope.CAR)

  const filterContext = useMemo(
    () => ({
      filters,
      setFilter: (key, values) => setFilters((f) => ({ ...f, [key]: values })),
      options: { divisionId: divisionFilterOptions(categories, t('divisions:noCategory')) },
    }),
    [filters, categories, t]
  )
  // null: closed; { car: null }: a new car; { car }: editing it
  const [form, setForm] = useState(null)

  const columns = useMemo(() => carColumns(t, { onEdit: (car) => setForm({ car }) }), [t])

  // Deletion is confirmed inside the button itself, then the list reloads
  async function handleDelete(id) {
    try {
      await fetch(`${API_URL}/api/cars/${id}`, { method: 'DELETE' })
    } finally {
      list.reload()
    }
  }

  return (
    <ColumnFilterContext.Provider value={filterContext}>
      <ListPage
        {...list.listProps}
        title={t('glossary:car', { count: 2 })}
        icon={<Car />}
        color="green"
        preferenceKey="cars"
        columns={columns}
        searchPlaceholder={t('searchPlaceholder')}
        addLabel={t('addLabel')}
        onAdd={() => setForm({ car: null })}
        onRowClick={(row) => !list.showDeleted && navigate(`/cars/${row.id}`)}
        renderGrid={(data) => (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((car) => (
              <CarCard
                key={car.id}
                car={car}
                onClick={() => navigate(`/cars/${car.id}`)}
                onEdit={() => setForm({ car })}
                onDelete={() => handleDelete(car.id)}
              />
            ))}
          </div>
        )}
        deleteEndpoint="/api/cars"
        exportEndpoint="/api/cars/export"
        emptyTitle={t('emptyTitle')}
        emptyMessage={t('emptyMessage')}
        hasActiveFilters={hasColumnFilters(filters) || list.showDeleted}
      >
        {form && (
          <CarFormModal
            car={form.car}
            onClose={() => {
              setForm(null)
              list.reload()
            }}
          />
        )}
      </ListPage>
    </ColumnFilterContext.Provider>
  )
}
