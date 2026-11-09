import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { ListPage } from '@/components/ui/list-page'
import TrackCard from '@/components/track/TrackCard'
import TrackFormModal from '@/components/track/TrackFormModal'
import { trackColumns } from '@/components/track/trackColumns'
import { usePagedList } from '@/hooks/usePagedList'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Tracks() {
  const { t } = useTranslation('tracks')
  const navigate = useNavigate()
  const list = usePagedList('/api/tracks')
  // null: closed; { track: null }: a new track; { track }: editing it
  const [form, setForm] = useState(null)

  const columns = useMemo(() => trackColumns(t, { onEdit: (track) => setForm({ track }) }), [t])

  // Deletion is confirmed inside the button itself, then the list reloads
  async function handleDelete(id) {
    try {
      await fetch(`${API_URL}/api/tracks/${id}`, { method: 'DELETE' })
    } finally {
      list.reload()
    }
  }

  return (
    <ListPage
      {...list.listProps}
      title={t('glossary:track', { count: 2 })}
      icon={<MapPin />}
      color="purple"
      preferenceKey="tracks"
      columns={columns}
      searchPlaceholder={t('searchPlaceholder')}
      addLabel={t('addLabel')}
      onAdd={() => setForm({ track: null })}
      onRowClick={(row) => !list.showDeleted && navigate(`/tracks/${row.id}`)}
      deleteEndpoint="/api/tracks"
      emptyTitle={t('emptyTitle')}
      emptyMessage={t('emptyMessage')}
      renderGrid={(data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => navigate(`/tracks/${track.id}`)}
              onEdit={() => setForm({ track })}
              onDelete={() => handleDelete(track.id)}
            />
          ))}
        </div>
      )}
    >
      {form && (
        <TrackFormModal
          track={form.track}
          onClose={() => {
            setForm(null)
            list.reload()
          }}
        />
      )}
    </ListPage>
  )
}
