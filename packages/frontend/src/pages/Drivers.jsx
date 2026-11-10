import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { ListPage } from '@/components/ui/list-page'
import DriverCard from '@/components/driver/DriverCard'
import DriverFormModal from '@/components/driver/DriverFormModal'
import { driverColumns } from '@/components/driver/driverColumns'
import { usePagedList } from '@/hooks/usePagedList'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Drivers() {
  const { t } = useTranslation('drivers')
  const navigate = useNavigate()
  const list = usePagedList('/api/drivers')
  const [teams, setTeams] = useState([])
  // null: closed; { driver: null }: a new driver; { driver }: editing them
  const [form, setForm] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/teams`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTeams(d.data || [])
      })
      .catch(() => {})
  }, [])

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
    >
      {form && (
        <DriverFormModal
          driver={form.driver}
          teams={teams}
          onClose={() => {
            setForm(null)
            list.reload()
          }}
        />
      )}
    </ListPage>
  )
}
