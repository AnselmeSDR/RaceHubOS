import { useSession } from '@/context/SessionContext'
import ActiveSessionBanner from './ActiveSessionBanner'
import CurrentChampionshipCard from './CurrentChampionshipCard'

/** What is going on now: the session that runs, else the championship under way. */
export default function NowCard() {
  const { isActive } = useSession()
  return isActive ? <ActiveSessionBanner /> : <CurrentChampionshipCard />
}
