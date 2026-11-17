import RecentSessions from '@/components/profile/RecentSessions'
import { entrySessions } from '@/components/profile/entrySessions'

const COLUMNS = ['date', 'type', 'session', 'track', 'place', 'best']

/** The car's last sessions, with its place and best lap in each. */
export default function CarRecentSessions({ car }) {
  return <RecentSessions testId="car-recent-sessions" columns={COLUMNS} rows={entrySessions(car.sessions)} />
}
