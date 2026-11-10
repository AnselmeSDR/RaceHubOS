import ActiveSessionBanner from '@/components/dashboard/ActiveSessionBanner'
import DriverLeaderboardCard from '@/components/dashboard/DriverLeaderboardCard'
import QuickActions from '@/components/dashboard/QuickActions'
import RecordsCard from '@/components/dashboard/RecordsCard'
import StatCards from '@/components/dashboard/StatCards'
import SystemStatus from '@/components/dashboard/SystemStatus'
import TopLapsCard from '@/components/dashboard/TopLapsCard'

/** Home page: each block is its own module, for add-ons to wrap or extend. */
export default function Dashboard() {
  return (
    <div className="p-4 space-y-4">
      <ActiveSessionBanner />
      <StatCards />
      <RecordsCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DriverLeaderboardCard />
        <TopLapsCard />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickActions />
        <SystemStatus />
      </div>
    </div>
  )
}
