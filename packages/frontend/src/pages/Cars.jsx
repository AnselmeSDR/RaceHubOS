import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car } from 'lucide-react'
import { ListPage } from '@/components/ui/list-page'
import CarCard from '@/components/car/CarCard'
import CarFormModal from '@/components/car/CarFormModal'
import { carColumns } from '@/components/car/carColumns'
import { usePagedList } from '@/hooks/usePagedList'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Cars() {
  const { t } = useTranslation('cars')
  const navigate = useNavigate()
  const list = usePagedList('/api/cars')
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
  )
}
