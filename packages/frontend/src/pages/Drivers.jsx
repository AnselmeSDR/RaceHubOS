import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import { ListPage } from '@/components/ui/list-page'
import { ColumnFilterContext } from '@/components/crud/columnFilterContext'
import DriverCard from '@/components/driver/DriverCard'
import DriverFormModal from '@/components/driver/DriverFormModal'
import { driverColumns } from '@/components/driver/driverColumns'
import { divisionFilterOptions } from '@/components/division/divisionFilterOptions'
import { useDivisions } from '@/hooks/useDivisions'
import { usePagedList } from '@/hooks/usePagedList'
import { filterParams, hasColumnFilters } from '@/lib/listFilters'

const API_URL = import.meta.env.VITE_API_URL || ''
const EMPTY_FILTERS = { divisionId: [] }

/** Every driver, filtered by division. */
export default function Drivers() {
  const { t } = useTranslation('drivers')
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const list = usePagedList('/api/drivers', filterParams(filters))
  const divisions = useDivisions(DivisionScope.DRIVER)
  // null: closed; { driver: null }: a new driver; { driver }: editing them
  const [form, setForm] = useState(null)

  const filterContext = useMemo(
    () => ({
      filters,
      setFilter: (key, values) => setFilters((f) => ({ ...f, [key]: values })),
      options: { divisionId: divisionFilterOptions(divisions, t('divisions:noDivision')) },
    }),
    [filters, divisions, t]
  )

  const columns = useMemo(() => driverColumns(t, { onEdit: (driver) => setForm({ driver }) }), [t])

  // Deletion is confirmed inside the button itself, then the list reloads
  async function handleDelete(id) {
    try {
      await fetch(`${API_URL}/api/drivers/${id}`, { method: 'DELETE' })
    } finally {
      list.reload()
    }
  }

  return (
    <ColumnFilterContext.Provider value={filterContext}>
      <ListPage
        {...list.listProps}
        title={t('glossary:driver', { count: 2 })}
        icon={<User />}
        color="blue"
        preferenceKey="drivers"
        columns={columns}
        searchPlaceholder={t('searchPlaceholder')}
        addLabel={t('addLabel')}
        onAdd={() => setForm({ driver: null })}
        onRowClick={(row) => !list.showDeleted && navigate(`/drivers/${row.id}`)}
        renderGrid={(data) => (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onClick={() => navigate(`/drivers/${driver.id}`)}
                onEdit={() => setForm({ driver })}
                onDelete={() => handleDelete(driver.id)}
              />
            ))}
          </div>
        )}
        deleteEndpoint="/api/drivers"
        exportEndpoint="/api/drivers/export"
        emptyTitle={t('emptyTitle')}
        emptyMessage={t('emptyMessage')}
        hasActiveFilters={hasColumnFilters(filters) || list.showDeleted}
      >
        {form && (
          <DriverFormModal
            driver={form.driver}
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
