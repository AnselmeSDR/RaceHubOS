import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '../components/crud'
import { ListPage } from '@/components/ui/list-page'
import { Card } from '@/components/ui/card'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Teams() {
  const { t } = useTranslation('teams')
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [sort, setSort] = useState(null)
  const [filters, setFilters] = useState({ deleted: false })

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
      if (filters.deleted) params.append('deleted', 'true')
      if (sort) {
        params.append('sortBy', sort.id)
        params.append('sortOrder', sort.desc ? 'desc' : 'asc')
      }
      params.append('offset', String(offset))
      params.append('limit', '50')
      const res = await fetch(`${API_URL}/api/teams?${params}`)
      const data = await res.json()
      if (data.success) {
        setTeams(prev => isFirst ? data.data : [...prev, ...data.data])
        setHasMore(data.hasMore ?? false)
        if (isFirst) setTotalCount(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to load teams:', err)
    } finally {
      if (isFirst) { setLoading(false); hasLoadedOnce.current = true }
      else setLoadingMore(false)
    }
  }

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: t('glossary:team', { count: 1 }),
      cell: ({ row }) => {
        const team = row.original
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: team.color || '#F97316' }}
            >
              {team.img ? (
                <img src={getImgUrl(team.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </div>
            <span className="font-semibold">{team.name}</span>
          </div>
        )
      },
    },
    {
      id: 'color',
      accessorKey: 'color',
      header: t('common:colorLabel'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: row.original.color || '#F97316' }} />
          <span className="text-muted-foreground font-mono text-xs">{row.original.color}</span>
        </div>
      ),
    },
    {
      id: 'drivers',
      accessorFn: (row) => row._count?.drivers || 0,
      header: t('glossary:driver', { count: 2 }),
      cell: ({ row }) => {
        const team = row.original
        return (
          <div>
            <span className="font-medium">{team._count?.drivers || 0}</span>
            {team.drivers?.length > 0 && (
              <span className="text-muted-foreground ml-1.5">
                ({team.drivers.slice(0, 2).map(d => d.name).join(', ')}{team.drivers.length > 2 ? '...' : ''})
              </span>
            )}
          </div>
        )
      },
    },
  ], [t])

  return (
    <ListPage
      title={t('glossary:team', { count: 2 })}
      icon={<Users />}
      color="orange"
      preferenceKey="teams"
      data={teams}
      totalCount={totalCount}
      columns={columns}
      loading={loading}
      searchPlaceholder={t('searchPlaceholder')}
      addLabel={t('addLabel')}
      onAdd={() => { setEditingTeam(null); setShowForm(true) }}
      onRowClick={(row) => { setEditingTeam(row); setShowForm(true) }}
      rowClassName={() => filters.deleted ? 'opacity-50' : ''}
      deleteEndpoint="/api/teams"
      onDeleted={() => loadData(0)}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => loadData(teams.length)}
      onSortChange={setSort}
      hasActiveFilters={filters.deleted}
      emptyTitle={t('emptyTitle')}
      emptyMessage={t('emptyMessage')}
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((team) => (
            <TeamCard key={team.id} team={team} onClick={() => { setEditingTeam(team); setShowForm(true) }} />
          ))}
        </div>
      )}
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
        <TeamFormModal
          team={editingTeam}
          onClose={() => { setShowForm(false); setEditingTeam(null); loadData(0) }}
        />
      )}
    </ListPage>
  )
}

function TeamCard({ team, onClick }) {
  const { t } = useTranslation('teams')
  const teamColor = team.color || '#F97316'

  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
      style={{ background: `linear-gradient(135deg, ${teamColor}10 0%, ${teamColor}05 100%)` }}
    >
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: teamColor }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: teamColor }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}CC 100%)` }}
            >
              {team.img ? (
                <img src={getImgUrl(team.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-12 h-12 drop-shadow-lg" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card/80 shadow-md">
            <div className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-border" style={{ backgroundColor: teamColor }} />
            <span className="text-xs font-mono font-bold text-muted-foreground">{teamColor}</span>
          </div>
        </div>
        <h3 className="font-black text-2xl tracking-tight text-foreground uppercase">{team.name}</h3>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: teamColor }} />
      </div>

      <div className="relative px-6 pb-6">
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: teamColor }} />
              <span className="text-sm font-bold text-muted-foreground uppercase">{t('glossary:driver', { count: 2 })}</span>
            </div>
            <span className="text-2xl font-black" style={{ color: teamColor }}>{team._count?.drivers || 0}</span>
          </div>
          {team.drivers?.length > 0 ? (
            <div className="space-y-1">
              {team.drivers.slice(0, 3).map((driver) => (
                <div key={driver.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }} />
                  <span className="text-foreground font-medium">{driver.name}</span>
                  {driver.number && <span className="text-muted-foreground text-xs">#{driver.number}</span>}
                </div>
              ))}
              {team.drivers.length > 3 && (
                <div className="text-xs text-muted-foreground italic mt-2">
                  {t('card.moreDrivers', { count: team.drivers.length - 3 })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">{t('common:noDrivers')}</div>
          )}
        </div>
      </div>
    </Card>
  )
}

function TeamFormModal({ team, onClose }) {
  const { t } = useTranslation('teams')
  const [formData, setFormData] = useState({
    name: team?.name || '',
    color: team?.color || '#F97316',
    img: team?.img || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = team ? `${API_URL}/api/teams/${team.id}` : `${API_URL}/api/teams`
      const res = await fetch(url, {
        method: team ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setSuccess(t('form.saved'))
        setTimeout(() => onClose(), 1500)
      } else {
        const data = await res.json()
        setError(data.error || t('common:saveError'))
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
      title={team ? t('form.editTitle') : t('form.createTitle')}
      icon={<Users className="w-5 h-5 text-primary" />}
      onSubmit={handleSubmit}
      isEditing={!!team}
      saving={saving}
      error={error}
      success={success}
    >
      <TextField label={t('fields.name')} value={formData.name} onChange={(v) => setFormData(f => ({ ...f, name: v }))} placeholder={t('form.namePlaceholder')} required />
      <PhotoUploadField label={t('form.logoLabel')} value={formData.img} onChange={(img) => setFormData(f => ({ ...f, img }))} shape="rect" onError={setError} uploadType="teams" />
      <ColorPickerField value={formData.color} onChange={(color) => setFormData(f => ({ ...f, color }))} />
    </FormModal>
  )
}
