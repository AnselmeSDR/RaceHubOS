import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { ListPage } from '@/components/ui/list-page'
import TrackCard from '@/components/track/TrackCard'
import TrackFormModal from '@/components/track/TrackFormModal'
import { trackColumns } from '@/components/track/trackColumns'
import { usePagedList } from '@/hooks/usePagedList'
import { pictureName, withViewTransition } from '@/lib/viewTransition'

export default function Tracks() {
  const { t } = useTranslation('tracks')
  const navigate = useNavigate()
  // The picture flies from its line or card to the header of the profile
  const open = (id) => withViewTransition(() => navigate(`/tracks/${id}`), pictureName('track', id))
  const list = usePagedList('/api/tracks')
  // null: closed; { track: null }: a new track; { track }: editing it
  const [form, setForm] = useState(null)

  const columns = useMemo(() => trackColumns(t, { onEdit: (track) => setForm({ track }) }), [t])

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
      onRowClick={(row) => !list.showDeleted && open(row.id)}
      deleteEndpoint="/api/tracks"
      emptyTitle={t('emptyTitle')}
      emptyMessage={t('emptyMessage')}
      renderGrid={(data) => (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
          {data.map((track) => (
            <TrackCard key={track.id} track={track} onClick={() => open(track.id)} />
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
