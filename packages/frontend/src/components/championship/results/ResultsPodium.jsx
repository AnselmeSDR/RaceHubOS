import { useTranslation } from 'react-i18next'
import DriverAvatar from '@/components/driver/DriverAvatar'

/** The championship's top three on steps, the winner in the middle; nothing with fewer than two. */
export default function ResultsPodium({ podium }) {
  const { t } = useTranslation('championships')
  if (!podium || podium.length < 2) return null

  const podiumBorder = ['border-yellow-400', 'border-gray-300', 'border-orange-400']
  const podiumGlow = ['shadow-yellow-400/20', 'shadow-gray-300/20', 'shadow-orange-400/20']
  const podiumHeight = ['h-28', 'h-20', 'h-16']
  const podiumBg = [
    'bg-gradient-to-t from-yellow-400/20 to-transparent',
    'bg-gradient-to-t from-gray-300/20 to-transparent',
    'bg-gradient-to-t from-orange-400/20 to-transparent',
  ]
  const podiumLabel = [
    t('results.podiumLabels.first'),
    t('results.podiumLabels.second'),
    t('results.podiumLabels.third'),
  ]
  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium
  const podiumIndexOrder = podium.length >= 3 ? [1, 0, 2] : podium.map((_, i) => i)

  return (
    <div className="flex items-end justify-center gap-6">
      {podiumOrder.map((entry, displayIdx) => {
        const realIdx = podiumIndexOrder[displayIdx]
        return (
          <div key={entry.driverId} className="flex flex-col items-center w-32">
            <DriverAvatar driver={entry.driver ?? { name: '?' }} className="size-20 mb-2" />
            <span className="text-sm font-bold mb-0.5">{entry.driver?.name}</span>
            <span className="text-[10px] text-muted-foreground mb-1">
              {t('results.lapsCount', { count: entry.totalLaps })}
            </span>
            <div
              className={`${podiumHeight[realIdx]} w-full ${podiumBg[realIdx]} ${podiumBorder[realIdx]} border-t-2 rounded-t-lg flex items-start justify-center pt-1.5 ${podiumGlow[realIdx]} shadow-lg`}
            >
              <span className="text-lg font-black text-foreground">{podiumLabel[realIdx]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
