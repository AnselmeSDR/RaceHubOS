import RecentSessions from '@/components/profile/RecentSessions'
import { entrySessions } from '@/components/profile/entrySessions'

const COLUMNS = ['date', 'type', 'session', 'track', 'place', 'best']

/** The driver's last sessions, with their place and best lap in each. */
export default function DriverRecentSessions({ driver }) {
  return <RecentSessions testId="driver-recent-sessions" columns={COLUMNS} rows={entrySessions(driver.sessions)} />
}
