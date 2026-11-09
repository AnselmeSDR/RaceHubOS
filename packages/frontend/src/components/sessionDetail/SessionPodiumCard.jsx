import { SessionStatus, SessionType } from '@racehubos/shared'
import { Card, CardContent } from '@/components/ui/card'
import Podium from '@/components/race/Podium'
import { sessionDuration } from '@/lib/sessionResults'

/** The podium of a finished session with drivers, with how it ended; none for balancing. */
export default function SessionPodiumCard({ session }) {
  const shown =
    session.status === SessionStatus.FINISHED && session.type !== SessionType.BALANCING && session.drivers?.length > 0
  if (!shown) return null

  const duration = sessionDuration(session)
  return (
    <Card data-testid="session-podium">
      <CardContent className="p-0 overflow-hidden">
        <Podium
          drivers={session.drivers}
          sessionType={session.type}
          stats={{
            duration: duration ? Math.floor(duration / 1000) : null,
            maxDuration: session.maxDuration,
            maxLaps: session.maxLaps,
            gracePeriod: session.gracePeriod,
            gracePeriodUsed: !!session.finishingAt,
          }}
        />
      </CardContent>
    </Card>
  )
}
