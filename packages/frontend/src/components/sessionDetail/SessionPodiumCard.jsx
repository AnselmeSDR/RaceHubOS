import { SessionStatus, SessionType } from '@racehubos/shared'
import { Card, CardContent } from '@/components/ui/card'
import Podium from '@/components/race/Podium'

/**
 * The podium of a finished race of at least two drivers. A practice or a qualifying opens on its
 * leaderboard, and one driver alone wins nothing; how the session ended is in the header.
 */
export default function SessionPodiumCard({ session }) {
  const shown =
    session.status === SessionStatus.FINISHED && session.type === SessionType.RACE && session.drivers?.length >= 2
  if (!shown) return null

  return (
    <Card data-testid="session-podium">
      <CardContent className="p-0 overflow-hidden">
        <Podium drivers={session.drivers} sessionType={session.type} />
      </CardContent>
    </Card>
  )
}
