import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, Medal, Users } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import { ListPage } from '@/components/ui/list-page'
import DivisionCard from '@/components/division/DivisionCard'
import DivisionFormModal from '@/components/division/DivisionFormModal'
import { divisionColumns } from '@/components/division/divisionColumns'
import { usePagedList } from '@/hooks/usePagedList'

const API_URL = import.meta.env.VITE_API_URL || ''
const TABS = [
  { scope: DivisionScope.DRIVER, labelKey: 'glossary:driver', Icon: Users },
  { scope: DivisionScope.CAR, labelKey: 'glossary:car', Icon: Car },
]

/** The drivers' divisions and the cars' categories, one tab each. */
export default function Divisions() {
  const { t } = useTranslation('divisions')
  const navigate = useNavigate()
  const [scope, setScope] = useState(DivisionScope.DRIVER)
  const list = usePagedList('/api/divisions', { scope })
  // null: closed; { division: null }: a new one; { division }: editing it
  const [form, setForm] = useState(null)
  const category = scope === DivisionScope.CAR

  const columns = useMemo(() => divisionColumns(t, scope, { onEdit: (division) => setForm({ division }) }), [t, scope])

  // Deletion is confirmed inside the button itself, then the list reloads
  async function handleDelete(id) {
    try {
      await fetch(`${API_URL}/api/divisions/${id}`, { method: 'DELETE' })
    } finally {
      list.reload()
    }
  }

  const tabs = (
    <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {TABS.map(({ scope: tab, labelKey, Icon }) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={scope === tab}
          onClick={() => setScope(tab)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            scope === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon aria-hidden="true" className="size-4" />
          {t(labelKey, { count: 2 })}
        </button>
      ))}
    </div>
  )

  return (
    <ListPage
      {...list.listProps}
      title={t('glossary:division', { count: 2 })}
      icon={<Medal />}
      color="purple"
      preferenceKey={`divisions:${scope}`}
      columns={columns}
      toolbar={tabs}
      searchPlaceholder={t(category ? 'searchCategory' : 'searchDivision')}
      addLabel={t(category ? 'addCategory' : 'addDivision')}
      onAdd={() => setForm({ division: null })}
      onRowClick={(row) => !list.showDeleted && navigate(`/divisions/${row.id}`)}
      deleteEndpoint="/api/divisions"
      exportEndpoint="/api/divisions/export"
      emptyTitle={t(category ? 'emptyCategories' : 'emptyDivisions')}
      emptyMessage={t(category ? 'emptyCategoriesHint' : 'emptyDivisionsHint')}
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((division) => (
            <DivisionCard
              key={division.id}
              division={division}
              onClick={() => navigate(`/divisions/${division.id}`)}
              onEdit={() => setForm({ division })}
              onDelete={() => handleDelete(division.id)}
            />
          ))}
        </div>
      )}
    >
      {form && (
        <DivisionFormModal
          division={form.division}
          scope={scope}
          onClose={() => {
            setForm(null)
            list.reload()
          }}
        />
      )}
    </ListPage>
  )
}
