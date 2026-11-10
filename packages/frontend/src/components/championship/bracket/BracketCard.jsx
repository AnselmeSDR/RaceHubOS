import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import { STATUS_COLORS } from '@/lib/colors'
import { bracketTime } from './bracketTime'

const API_URL = import.meta.env.VITE_API_URL || ''

const STATUS_ICONS = {
  [SessionStatus.DRAFT]: Circle,
  [SessionStatus.ACTIVE]: Loader2,
  [SessionStatus.PAUSED]: Clock,
  [SessionStatus.FINISHING]: Clock,
  [SessionStatus.FINISHED]: CheckCircle2,
}
const QUALIF_STYLE = 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
const RACE_STYLE = 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'

/** A driver of the group: grid slot, photo and name, then, once finished, the race place and time or the best lap. */
function GroupDriver({ entry, isRace, finished }) {
  const placed = isRace && finished && entry.finalPos
  const time = isRace ? entry.totalTime : entry.bestLapTime
  return (
    <div data-testid="bracket-driver" className="flex items-center gap-2 text-xs">
      {entry.gridPos && <span className="w-4 text-right text-muted-foreground">{entry.gridPos}.</span>}
      {entry.driver?.img && (
        <img src={`${API_URL}${entry.driver.img}`} className="w-4 h-4 rounded-full object-cover" alt="" />
      )}
      <span className="flex-1 truncate">{entry.driver?.name || '?'}</span>
      {placed && (
        <span
          className={`font-medium tabular-nums ${
            entry.finalPos <= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
          }`}
        >
          P{entry.finalPos}
        </span>
      )}
      {finished && time > 0 && <span className="text-muted-foreground tabular-nums">{bracketTime(time)}</span>}
    </div>
  )
}

/** A qualifying or race group of the bracket: its label and status, its name, its drivers. */
export default function BracketCard({ group, type }) {
  const { t } = useTranslation('championships')
  const { label, name, status, drivers } = group
  const colors = STATUS_COLORS[status] || STATUS_COLORS.draft
  const StatusIcon = STATUS_ICONS[status] || Circle
  const finished = status === SessionStatus.FINISHED
  const isRace = type === SessionType.RACE

  return (
    <div className={`border rounded-lg p-3 ${isRace ? RACE_STYLE : QUALIF_STYLE}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm">{label}</span>
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          <StatusIcon className={`w-3 h-3 ${status === SessionStatus.ACTIVE ? 'animate-spin' : ''}`} />
          {t(`bracket.statusLabels.${status}`, status)}
        </span>
      </div>
      {name && <p className="text-xs text-muted-foreground mb-2">{name}</p>}
      {drivers?.length > 0 ? (
        <div className="space-y-1">
          {drivers.map((entry, i) => (
            <GroupDriver key={entry.id || i} entry={entry} isRace={isRace} finished={finished} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">{t('bracket.waitingQualifs')}</p>
      )}
    </div>
  )
}
