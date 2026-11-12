import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import LapTime from '@/components/race/LapTime'
import { Card, CardContent } from '@/components/ui/card'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { fastestLapTime } from '@/lib/sessionResults'

const UNKNOWN_DRIVER_COLOR = '#6B7280'

/** Every lap of a stored session in order, with its driver and car, the fastest highlighted; none for balancing. */
export default function SessionLapHistory({ session }) {
  const { t } = useTranslation('sessions')
  if (!session.laps?.length || session.type === SessionType.BALANCING) return null
  const fastestLap = fastestLapTime(session.drivers)

  return (
    <Card data-testid="session-lap-history">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t('profile.lapHistory', { count: session.laps.length })}</h3>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2 font-medium">{t('glossary:lap', { count: 1 })}</th>
                <th className="px-4 py-2 font-medium">{t('glossary:driver', { count: 1 })}</th>
                <th className="px-4 py-2 font-medium">{t('glossary:car', { count: 1 })}</th>
                <th className="px-4 py-2 font-medium text-right">{t('profile.time')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {session.laps.map((lap, i) => {
                const driver = session.drivers?.find((d) => d.controller === lap.controller)
                return (
                  <tr key={lap.id || i} className={`${lap.lapTime === fastestLap ? 'bg-purple-500/10' : ''}`}>
                    <td className="px-4 py-1.5 font-mono text-muted-foreground">{lap.lapNumber}</td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <DriverAvatar
                          driver={driver?.driver ?? { name: '?', color: UNKNOWN_DRIVER_COLOR }}
                          className="size-5"
                        />
                        <span className="truncate">{driver?.driver?.name || `Ctrl ${lap.controller + 1}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-1.5 text-muted-foreground truncate">
                      {driver?.car?.brand} {driver?.car?.model}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <LapTime time={Math.round(lap.lapTime)} size="sm" highlight={lap.lapTime === fastestLap} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
