import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { ListPage } from '@/components/ui/list-page'
import TeamCard from '@/components/team/TeamCard'
import TeamFormModal from '@/components/team/TeamFormModal'
import { teamColumns } from '@/components/team/teamColumns'
import { usePagedList } from '@/hooks/usePagedList'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Teams() {
  const { t } = useTranslation('teams')
  const list = usePagedList('/api/teams')
  // null: closed; { team: null }: a new team; { team }: editing it
  const [form, setForm] = useState(null)

  const columns = useMemo(() => teamColumns(t), [t])

  // Deletion is confirmed inside the button itself, then the list reloads
  async function handleDelete(id) {
    try {
      await fetch(`${API_URL}/api/teams/${id}`, { method: 'DELETE' })
    } finally {
      list.reload()
    }
  }

  return (
    <ListPage
      {...list.listProps}
      title={t('glossary:team', { count: 2 })}
      icon={<Users />}
      color="orange"
      preferenceKey="teams"
      columns={columns}
      searchPlaceholder={t('searchPlaceholder')}
      addLabel={t('addLabel')}
      onAdd={() => setForm({ team: null })}
      onRowClick={(row) => setForm({ team: row })}
      deleteEndpoint="/api/teams"
      emptyTitle={t('emptyTitle')}
      emptyMessage={t('emptyMessage')}
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onClick={() => setForm({ team })}
              onDelete={() => handleDelete(team.id)}
            />
          ))}
        </div>
      )}
    >
      {form && (
        <TeamFormModal
          team={form.team}
          onClose={() => {
            setForm(null)
            list.reload()
          }}
        />
      )}
    </ListPage>
  )
}
