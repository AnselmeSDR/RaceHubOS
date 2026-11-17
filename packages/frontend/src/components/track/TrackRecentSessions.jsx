import { useTranslation } from 'react-i18next'
import RecentSessions from '@/components/profile/RecentSessions'

const COLUMNS = ['date', 'type', 'session', 'drivers']

/** The last sessions run on the track, with their drivers count; one without a name goes by its type. */
export default function TrackRecentSessions({ track }) {
  const { t } = useTranslation('glossary')
  const rows = (track.sessions ?? []).map((session) => ({
    id: session.id,
    to: `/sessions/${session.id}`,
    date: session.startedAt ?? session.createdAt,
    type: session.type,
    name: session.name || (session.type ? t(`sessionType.${session.type}`, { defaultValue: session.type }) : ''),
    drivers: session._count?.drivers,
  }))
  return <RecentSessions testId="track-recent-sessions" columns={COLUMNS} rows={rows} />
}
