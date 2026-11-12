import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { CHAMPIONSHIP_STATUSES } from '@racehubos/shared'
import { ListPage } from '@/components/ui/list-page'
import { championshipColumns } from '../components/championship/championshipColumns'
import ChampionshipWizard from '../components/championship/ChampionshipWizard'
import { ColumnFilterContext } from '../components/crud/columnFilterContext'
import { usePagedList } from '../hooks/usePagedList'
import { filterParams, hasColumnFilters } from '../lib/listFilters'
import { getData } from '../lib/sessionApi'

const EMPTY_FILTERS = { trackId: [], status: [] }

/** Every championship, filtered by track and status. Adding opens the creation wizard. */
export default function Championships() {
  const { t } = useTranslation('championships')
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [tracks, setTracks] = useState([])
  const [creating, setCreating] = useState(false)
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

  const closeWizard = () => {
    setCreating(false)
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
        onAdd={() => setCreating(true)}
        // A deleted championship has no page to open
        onRowClick={(row) => !list.showDeleted && navigate(`/championships/${row.id}`)}
        deleteEndpoint="/api/championships"
        exportEndpoint="/api/championships/export"
        hasActiveFilters={hasColumnFilters(filters) || list.showDeleted}
      >
        {creating && <ChampionshipWizard tracks={tracks} onClose={closeWizard} onCreated={list.reload} />}
      </ListPage>
    </ColumnFilterContext.Provider>
  )
}
