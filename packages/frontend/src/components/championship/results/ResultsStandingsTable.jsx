import { useTranslation } from 'react-i18next'
import { GAP_COLORS } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'
import { formatTotalTime } from './format'

/** The final standings: laps, total time and the gap to the leader, in laps or seconds. */
export default function ResultsStandingsTable({ standings }) {
  const { t } = useTranslation('championships')
  if (!standings?.length) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs uppercase bg-muted/50">
            <th className="px-3 py-2 w-8">#</th>
            <th className="px-3 py-2">{t('results.table.driver')}</th>
            <th className="px-3 py-2 text-center w-16">{t('results.table.laps')}</th>
            <th className="px-3 py-2 text-right w-24">{t('results.table.time')}</th>
            <th className="px-3 py-2 text-right w-20">{t('results.table.gap')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {standings.map((entry) => {
            const leaderLaps = standings[0].totalLaps
            const leaderTime = standings[0].totalTime
            const lapDiff = leaderLaps - entry.totalLaps
            let gap = null
            if (entry.position > 1) {
              gap =
                lapDiff > 0 ? { type: 'laps', value: lapDiff } : { type: 'time', value: entry.totalTime - leaderTime }
            }

            return (
              <tr
                key={entry.driverId}
                className={
                  entry.position === 1
                    ? 'bg-gradient-to-r from-yellow-500/20 to-transparent'
                    : entry.position === 2
                      ? 'bg-gradient-to-r from-gray-400/10 to-transparent'
                      : entry.position === 3
                        ? 'bg-gradient-to-r from-orange-500/10 to-transparent'
                        : ''
                }
              >
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                      entry.position === 1
                        ? 'bg-yellow-400 text-yellow-950'
                        : entry.position === 2
                          ? 'bg-gray-300 text-gray-800'
                          : entry.position === 3
                            ? 'bg-orange-400 text-orange-950'
                            : 'text-muted-foreground'
                    }`}
                  >
                    {entry.position}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {entry.driver?.img && (
                      <img src={getImgUrl(entry.driver.img)} className="w-6 h-6 rounded-full object-cover" alt="" />
                    )}
                    <div>
                      <div className="font-medium">{entry.driver?.name}</div>
                      {entry.car && (
                        <div className="text-[10px] text-muted-foreground">
                          {entry.car.brand} {entry.car.model}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-center font-mono font-bold">{entry.totalLaps}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{formatTotalTime(entry.totalTime)}</td>
                <td className="px-3 py-2 text-right">
                  {gap ? (
                    <span
                      className={`font-mono text-xs font-medium ${gap.type === 'laps' ? GAP_COLORS.laps : 'text-muted-foreground'}`}
                    >
                      {gap.type === 'laps'
                        ? t('results.gapLaps', { count: gap.value })
                        : `+${(gap.value / 1000).toFixed(3)}`}
                    </span>
                  ) : (
                    <span className={`text-xs font-bold ${GAP_COLORS.leader}`}>{t('results.leader')}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
