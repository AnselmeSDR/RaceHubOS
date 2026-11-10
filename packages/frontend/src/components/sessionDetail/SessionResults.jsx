import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import BalancingChart from '@/components/balancing/BalancingChart'
import SessionLeaderboard from '@/components/race/SessionLeaderboard'
import { Card, CardContent } from '@/components/ui/card'
import { balancingEntries } from '@/lib/sessionResults'

function Empty({ children }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  )
}

/** A stored session's leaderboard, or for a balancing session its lap chart. */
export default function SessionResults({ session, entries }) {
  const { t } = useTranslation('sessions')

  if (session.type === SessionType.BALANCING) {
    const chartEntries = balancingEntries(session)
    if (!chartEntries.some((e) => e.laps.length > 0)) return <Empty>{t('profile.noLapData')}</Empty>
    return <BalancingChart entries={chartEntries} />
  }

  if (entries.length === 0) return <Empty>{t('profile.noParticipants')}</Empty>
  return (
    <SessionLeaderboard
      entries={entries}
      sortBy={session.type === SessionType.RACE ? 'race' : 'bestLap'}
      sessionType={session.type}
      sessionStatus={session.status}
      expanded
    />
  )
}
