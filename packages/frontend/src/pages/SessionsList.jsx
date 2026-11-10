import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import { SessionStatus } from '@racehubos/shared'
import { ListPage } from '@/components/ui/list-page'
import SessionForm from '../components/SessionForm'
import { ColumnFilterContext } from '../components/crud/columnFilterContext'
import { sessionColumns } from '../components/sessionList/sessionColumns'
import { usePagedList } from '../hooks/usePagedList'
import { filterParams, hasColumnFilters } from '../lib/listFilters'
import { getData } from '../lib/sessionApi'
import { sessionTypeOptions } from '../utils/sessionTypes'

const EMPTY_FILTERS = { status: [], trackId: [], type: [], championshipId: [] }
const FILTERED_STATUSES = [SessionStatus.DRAFT, SessionStatus.ACTIVE, SessionStatus.FINISHED]

/** Every session, filtered by type, track, status and championship; a new one from the header. */
export default function SessionsList() {
  const { t, i18n } = useTranslation('sessions')
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [lists, setLists] = useState({ tracks: [], championships: [] })
  const [showForm, setShowForm] = useState(false)
  const list = usePagedList('/api/sessions', filterParams(filters))

  useEffect(() => {
    Promise.all([getData('/api/tracks'), getData('/api/championships')]).then(([tracks, championships]) => {
      setLists((prev) => ({
        tracks: tracks || prev.tracks,
        championships: championships || prev.championships,
      }))
    })
  }, [])

  const filterContext = useMemo(
    () => ({
      filters,
      setFilter: (key, values) => setFilters((f) => ({ ...f, [key]: values })),
      options: {
        type: sessionTypeOptions(t),
        trackId: lists.tracks.map((track) => ({ value: track.id, label: track.name })),
        status: FILTERED_STATUSES.map((value) => ({ value, label: t(`glossary:sessionStatus.${value}`) })),
        championshipId: [
          { value: 'null', label: t('filters.noChampionship') },
          ...lists.championships.map((c) => ({ value: c.id, label: c.name })),
        ],
      },
    }),
    [filters, lists, t]
  )

  const columns = useMemo(() => sessionColumns(t, { lang: i18n.language }), [t, i18n.language])

  return (
    <ColumnFilterContext.Provider value={filterContext}>
      <ListPage
        {...list.listProps}
        title={t('glossary:session', { count: 2 })}
        icon={<Flag />}
        color="indigo"
        preferenceKey="sessions"
        columns={columns}
        searchPlaceholder={t('searchPlaceholder')}
        addLabel={t('addLabel')}
        onAdd={() => setShowForm(true)}
        // A deleted session has no page to open
        onRowClick={(row) => !list.showDeleted && navigate(`/sessions/${row.id}`)}
        deleteEndpoint="/api/sessions"
        exportEndpoint="/api/sessions/export"
        hasActiveFilters={hasColumnFilters(filters) || list.showDeleted}
        emptyTitle={t('emptyTitle')}
        emptyMessage={t('emptyMessage')}
      >
        {showForm && (
          <SessionForm
            onClose={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false)
              list.reload()
            }}
          />
        )}
      </ListPage>
    </ColumnFilterContext.Provider>
  )
}
