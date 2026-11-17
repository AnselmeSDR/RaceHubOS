import DashboardCounts from '@/components/dashboard/DashboardCounts'
import DriverLeaderboardCard from '@/components/dashboard/DriverLeaderboardCard'
import NowCard from '@/components/dashboard/NowCard'
import RecentSessionsCard from '@/components/dashboard/RecentSessionsCard'
import TopLapsCard from '@/components/dashboard/TopLapsCard'

/**
 * Home page: what is going on now, what happened lately, then the all-time figures. Each block is its
 * own module, for add-ons to wrap or extend.
 */
export default function Dashboard() {
  return (
    <div className="@container p-4 space-y-4">
      <DashboardCounts />
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <NowCard />
        <RecentSessionsCard />
      </div>
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <DriverLeaderboardCard />
        <TopLapsCard />
      </div>
    </div>
  )
}
