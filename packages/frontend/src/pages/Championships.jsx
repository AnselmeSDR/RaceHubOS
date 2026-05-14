import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trophy, MapPin, Flag, Clock } from 'lucide-react'
import { FormModal, TextField, SelectField } from '../components/crud'
import AutoChampionshipWizard from '../components/championship/AutoChampionshipWizard'
import { ListPage } from '@/components/ui/list-page'
import { FilterHeader } from '@/components/ui/filter-header'
import { Badge } from '@/components/ui/badge'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Championships() {
  const { t } = useTranslation('championships')
  const navigate = useNavigate()
  const [championships, setChampionships] = useState([])
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [showAutoWizard, setShowAutoWizard] = useState(false)
  const [sharedForm, setSharedForm] = useState({ name: '', trackId: '' })

  const [filters, setFilters] = useState({
    trackId: [],
    status: [],
    deleted: false,
  })
  const [sort, setSort] = useState(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  useEffect(() => {
    fetch(`${API_URL}/api/tracks`).then(r => r.json()).then(d => {
      if (d.success) setTracks(d.data || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadData(0)
  }, [filters, sort])

  const hasLoadedOnce = useRef(false)

  async function loadData(offset) {
    const isFirst = offset === 0
    if (isFirst && !hasLoadedOnce.current) setLoading(true)
    else if (!isFirst) setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (filters.trackId.length) params.append('trackId', filters.trackId.join(','))
      if (filters.status.length) params.append('status', filters.status.join(','))
      if (filters.deleted) params.append('deleted', 'true')
      if (sort) {
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }
      params.append('offset', String(offset))
      params.append('limit', '50')
      const res = await fetch(`${API_URL}/api/championships?${params}`)
      const data = await res.json()
      if (data.success) {
        setChampionships(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load championships:', err)
    } finally {
      if (isFirst) { setLoading(false); hasLoadedOnce.current = true }
      else setLoadingMore(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <span className="font-semibold">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: 'track',
      accessorFn: (row) => tracks.find(tr => tr.id === row.trackId)?.name || '',
      meta: { label: t('glossary:track', { count: 1 }) },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label={t('glossary:track', { count: 1 })}
          active={filtersRef.current.trackId.length > 0}
          value={filtersRef.current.trackId}
          options={tracks.map(tr => ({ value: tr.id, label: tr.name }))}
          onChange={(v) => setFilters(f => ({ ...f, trackId: v }))}
        />
      ),
      cell: ({ row }) => {
        const track = tracks.find(tr => tr.id === row.original.trackId)
        return (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            {track?.name || t('common:notDefined')}
          </span>
        )
      },
    },
    {
      id: 'qualifs',
      accessorFn: (row) => row.sessions?.filter(s => s.type === 'qualif').length || 0,
      header: t('columns.qualifs'),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4 text-blue-500" />
          {row.original.sessions?.filter(s => s.type === 'qualif').length || 0}
        </span>
      ),
    },
    {
      id: 'races',
      accessorFn: (row) => row.sessions?.filter(s => s.type === 'race').length || 0,
      header: t('columns.races'),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Flag className="w-4 h-4 text-green-500" />
          {row.original.sessions?.filter(s => s.type === 'race').length || 0}
        </span>
      ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.status || 'planned',
      meta: { label: t('common:status') },
      header: ({ column }) => (
        <FilterHeader
          column={column}
          label={t('common:status')}
          active={filtersRef.current.status.length > 0}
          value={filtersRef.current.status}
          options={[
            { value: 'planned', label: t('glossary:championshipStatus.planned') },
            { value: 'active', label: t('glossary:championshipStatus.active') },
            { value: 'finished', label: t('glossary:championshipStatus.finished') },
          ]}
          onChange={(v) => setFilters(f => ({ ...f, status: v }))}
        />
      ),
      cell: ({ row }) => {
        const styles = {
          active: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
          finished: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          planned: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
        }
        const key = row.original.status || 'planned'
        return (
          <Badge className={styles[key] || styles.planned}>
            {t(`glossary:championshipStatus.${key}`)}
          </Badge>
        )
      },
    },
  ], [tracks, t])

  return (
    <ListPage
      title={t('glossary:championship', { count: 2 })}
      icon={<Trophy />}
      color="yellow"
      preferenceKey="championships"
      data={championships}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder={t('searchPlaceholder')}
      addLabel={t('addLabel')}
      onAdd={() => setShowAutoWizard(true)}
      onRowClick={(row) => !filters.deleted && navigate(`/championships/${row.id}`)}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      deleteEndpoint="/api/championships"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(championships.length)}
      onSortChange={setSort}
      hasActiveFilters={filters.trackId.length > 0 || filters.status.length > 0 || filters.deleted}
      options={[
        {
          key: 'deleted',
          label: t('common:showDeleted'),
          checked: filters.deleted,
          onChange: (v) => setFilters(f => ({ ...f, deleted: !!v })),
        },
      ]}
    >
      {showForm && (
        <ChampionshipFormModal
          tracks={tracks}
          initialData={sharedForm}
          onFormChange={setSharedForm}
          onClose={() => { setShowForm(false); setSharedForm({ name: '', trackId: '' }); loadData(0) }}
          onSwitchAuto={() => { setShowForm(false); setShowAutoWizard(true) }}
        />
      )}
      {showAutoWizard && (
        <AutoChampionshipWizard
          tracks={tracks}
          initialName={sharedForm.name}
          initialTrackId={sharedForm.trackId}
          onFormChange={setSharedForm}
          onClose={() => { setShowAutoWizard(false); setSharedForm({ name: '', trackId: '' }); loadData(0) }}
          onCreated={() => loadData(0)}
          onSwitchManual={() => { setShowAutoWizard(false); setShowForm(true) }}
        />
      )}
    </ListPage>
  )
}

function ChampionshipFormModal({ tracks, initialData, onFormChange, onClose, onSwitchAuto }) {
  const { t } = useTranslation('championships')
  const [formData, setFormData] = useState(initialData || { name: '', trackId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    if (!formData.name || !formData.trackId) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/championships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          trackId: formData.trackId,
          season: new Date().getFullYear().toString(),
          pointsSystem: '{}'
        })
      })
      if (res.ok) {
        setSuccess(t('form.saved'))
        setTimeout(() => onClose(), 1500)
      } else {
        setError(t('form.createError'))
      }
    } catch {
      setError(t('common:connectionError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onClose}
      title={t('form.createTitle')}
      icon={<Trophy className="w-5 h-5 text-primary" />}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
      success={success}
      saveLabel={t('common:create')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('form.autoMode')}</span>
        <button
          type="button"
          onClick={() => onSwitchAuto?.()}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-muted"
        >
          <span className="inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform translate-x-1" />
        </button>
      </div>
      <TextField
        label={t('form.name')}
        value={formData.name}
        onChange={(v) => { const next = { ...formData, name: v }; setFormData(next); onFormChange?.(next) }}
        placeholder={t('form.namePlaceholder')}
        required
      />
      <SelectField
        label={t('glossary:track', { count: 1 })}
        value={formData.trackId}
        onChange={(v) => { const next = { ...formData, trackId: v }; setFormData(next); onFormChange?.(next) }}
        options={tracks.map(tr => ({ value: tr.id, label: tr.name }))}
        placeholder={t('form.selectTrack')}
        required
      />
    </FormModal>
  )
}
