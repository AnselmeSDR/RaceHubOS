import { useTranslation } from 'react-i18next'
import { Activity, Clock, Heart, Timer, TrendingUp, Trophy, Zap } from 'lucide-react'
import { GAP_COLORS } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'
import { formatLapTime } from './format'

const AWARD_ICONS = {
  'best-lap': Timer,
  'best-qualif': Clock,
  'best-race-lap': Zap,
  'comeback': TrendingUp,
  'consistent': Activity,
  'iron-man': Heart,
}

/** One of the championship's best moments: what it is, who earned it, and its value. */
export default function AwardCard({ award }) {
  const { t } = useTranslation('championships')
  const Icon = AWARD_ICONS[award.id] || Trophy

  const renderValue = () => {
    switch (award.id) {
      case 'best-lap':
      case 'best-qualif':
      case 'best-race-lap':
        return (
          <div>
            <span className={`font-mono text-lg font-bold ${GAP_COLORS.leader}`}>{formatLapTime(award.lapTime)}</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">{award.sessionName}</div>
          </div>
        )
      case 'comeback':
        return (
          <div>
            <span className="font-mono text-lg font-bold text-session-race">
              {t('results.award.places', { count: award.gain })}
            </span>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              P{award.qualifPos} → P{award.racePos}
            </div>
          </div>
        )
      case 'consistent':
        return (
          <div>
            <span className="font-mono text-lg font-bold text-session-qualif">σ {formatLapTime(award.stdDev)}</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">{award.sessionName}</div>
          </div>
        )
      case 'iron-man':
        return (
          <div>
            <span className="font-mono text-lg font-bold text-delta-gained">
              {t('results.award.lapsCount', { count: award.totalLaps })}
            </span>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {t('results.award.finishedRaces', { count: award.finishedRaces })}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-championship/10">
          <Icon className="size-4 text-championship" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            data-testid="championship-award-title"
            className="text-xs font-semibold text-muted-foreground uppercase mb-1"
          >
            {t(`results.awardTitles.${award.id}`, { defaultValue: award.title })}
          </div>
          <div className="flex items-center gap-2">
            {award.driver?.img && (
              <img src={getImgUrl(award.driver.img)} className="w-6 h-6 rounded-full object-cover" alt="" />
            )}
            <span className="text-sm font-medium truncate">{award.driver?.name}</span>
          </div>
          <div className="mt-1">{renderValue()}</div>
        </div>
      </div>
    </div>
  )
}
