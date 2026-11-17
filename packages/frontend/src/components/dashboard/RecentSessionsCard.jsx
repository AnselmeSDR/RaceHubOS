import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SessionStatus } from '@racehubos/shared'
import DriverAvatar from '@/components/driver/DriverAvatar'
import SessionTypeBadge from '@/components/profile/SessionTypeBadge'
import LapTime from '@/components/race/LapTime'
import { GRID_HEAD, GRID_LIST, GRID_ROW } from '@/lib/gridList'
import Panel from './Panel'
import { useApiData } from './useApiData'

const COLUMNS = 'max-content max-content minmax(0,auto) minmax(0,auto) minmax(0,auto) max-content'

/** The last finished sessions, with who won and the best lap; a line opens the session. */
export default function RecentSessionsCard() {
  const { t, i18n } = useTranslation('dashboard')
  const sessions = useApiData(`/sessions?status=${SessionStatus.FINISHED}&limit=6`, [])
  if (sessions.length === 0) return null
  const day = (date) => new Date(date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })

  return (
    <Panel
      testId="dashboard-recent-sessions"
      title={t('recent.title')}
      to="/history"
      link={`${t('layout:nav.history')} →`}
    >
      <div className={GRID_LIST} style={{ gridTemplateColumns: COLUMNS }}>
        <div className={GRID_HEAD}>
          <span>{t('common:date')}</span>
          <span>{t('common:type')}</span>
          <span>{t('glossary:session', { count: 1 })}</span>
          <span>{t('glossary:championship', { count: 1 })}</span>
          <span>{t('recent.first')}</span>
          <span className="text-right">{t('common:bestShort')}</span>
        </div>
        {sessions.map((session) => {
          const winner = session.drivers?.find((entry) => entry.finalPos === 1)?.driver
          const best = Math.min(...(session.drivers ?? []).map((entry) => entry.bestLapTime || Infinity))
          return (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              className={`${GRID_ROW} hover:bg-muted transition-colors`}
            >
              <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                {day(session.finishedAt ?? session.updatedAt)}
              </span>
              <span>
                <SessionTypeBadge type={session.type} />
              </span>
              <span className="truncate font-semibold">{session.name}</span>
              <span className={`truncate ${session.championship ? '' : 'text-muted-foreground'}`}>
                {session.championship?.name ?? t('layout:nav.freeMode')}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {winner && <DriverAvatar driver={winner} className="size-5" />}
                <span className="truncate font-medium">{winner?.name}</span>
              </span>
              <span className="text-right">
                {Number.isFinite(best) && <LapTime time={best} size="sm" className="text-foreground" />}
              </span>
            </Link>
          )
        })}
      </div>
    </Panel>
  )
}
