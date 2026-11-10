import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { CHAMPIONSHIP_STATUSES } from '@racehubos/shared'
import { ListPage } from '@/components/ui/list-page'
import AutoChampionshipWizard from '../components/championship/AutoChampionshipWizard'
import ChampionshipFormModal from '../components/championship/ChampionshipFormModal'
import { championshipColumns } from '../components/championship/championshipColumns'
import { ColumnFilterContext } from '../components/crud/columnFilterContext'
import { usePagedList } from '../hooks/usePagedList'
import { filterParams, hasColumnFilters } from '../lib/listFilters'
import { getData } from '../lib/sessionApi'

const EMPTY_FILTERS = { trackId: [], status: [] }
const EMPTY_FORM = { name: '', trackId: '' }

/**
 * Every championship, filtered by track and status. Adding opens the automatic wizard, which can switch
 * to the manual form and back, keeping the name and track typed.
 */
export default function Championships() {
  const { t } = useTranslation('championships')
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [tracks, setTracks] = useState([])
  const [creating, setCreating] = useState(null) // 'auto' | 'manual' | null
  const [sharedForm, setSharedForm] = useState(EMPTY_FORM)
  const list = usePagedList('/api/championships', filterParams(filters))

  useEffect(() => {
    getData('/api/tracks').then((data) => {
      if (data) setTracks(data)
    })
  }, [])

  const filterContext = useMemo(
    () => ({
      filters,
      setFilter: (key, values) => setFilters((f) => ({ ...f, [key]: values })),
      options: {
        trackId: tracks.map((tr) => ({ value: tr.id, label: tr.name })),
        status: CHAMPIONSHIP_STATUSES.map((value) => ({ value, label: t(`glossary:championshipStatus.${value}`) })),
      },
    }),
    [filters, tracks, t]
  )

  const columns = useMemo(() => championshipColumns(t, { tracks }), [t, tracks])

  const closeForm = () => {
    setCreating(null)
    setSharedForm(EMPTY_FORM)
    list.reload()
  }

  return (
    <ColumnFilterContext.Provider value={filterContext}>
      <ListPage
        {...list.listProps}
        title={t('glossary:championship', { count: 2 })}
        icon={<Trophy />}
        color="yellow"
        preferenceKey="championships"
        columns={columns}
        searchPlaceholder={t('searchPlaceholder')}
        addLabel={t('addLabel')}
        onAdd={() => setCreating('auto')}
        // A deleted championship has no page to open
        onRowClick={(row) => !list.showDeleted && navigate(`/championships/${row.id}`)}
        deleteEndpoint="/api/championships"
        exportEndpoint="/api/championships/export"
        hasActiveFilters={hasColumnFilters(filters) || list.showDeleted}
      >
        {creating === 'manual' && (
          <ChampionshipFormModal
            tracks={tracks}
            initialData={sharedForm}
            onFormChange={setSharedForm}
            onClose={closeForm}
            onSwitchAuto={() => setCreating('auto')}
          />
        )}
        {creating === 'auto' && (
          <AutoChampionshipWizard
            tracks={tracks}
            initialName={sharedForm.name}
            initialTrackId={sharedForm.trackId}
            onFormChange={setSharedForm}
            onClose={closeForm}
            onCreated={list.reload}
            onSwitchManual={() => setCreating('manual')}
          />
        )}
      </ListPage>
    </ColumnFilterContext.Provider>
  )
}
