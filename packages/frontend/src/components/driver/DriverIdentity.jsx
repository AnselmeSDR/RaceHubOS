import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import LapTime from '@/components/race/LapTime'
import { getImgUrl } from '@/utils/image'
import { driverColor } from '@/lib/colors'

/** Picture, name, number, team and figures of a driver, at the top of their profile. */
export default function DriverIdentity({ driver }) {
  const { t } = useTranslation('drivers')
  const color = driverColor(driver)

  return (
    <div className="min-w-0 flex items-center gap-3" data-testid="driver-identity">
      <div
        className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-bold ring-2 ring-offset-2 ring-offset-background"
        style={{ backgroundColor: color, '--tw-ring-color': color }}
      >
        {driver.img ? (
          <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
        ) : (
          <span>{driver.name.charAt(0)}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-black text-lg" style={{ color }}>
            {driver.name}
          </h1>
          {driver.number && <span className="text-sm font-black italic text-muted-foreground">#{driver.number}</span>}
          {driver.team && (
            <Badge
              variant="secondary"
              data-testid="driver-team-badge"
              className="inline-block h-auto max-w-full whitespace-normal break-words"
              style={{
                backgroundColor: `${driver.team.color || color}20`,
                color: driver.team.color || color,
              }}
            >
              {driver.team.name}
            </Badge>
          )}
        </div>
        <div className="text-xs flex flex-wrap items-center gap-3">
          <span className="text-blue-500 font-medium">
            {driver._count?.sessions || 0} {t('glossary:race', { count: driver._count?.sessions || 0 })}
          </span>
          <span className="text-yellow-500 font-medium">
            {driver.wins || 0} {t('glossary:win', { count: driver.wins || 0 })}
          </span>
          <span className="text-orange-400 font-medium">
            {driver.podiums || 0} {t('glossary:podium', { count: driver.podiums || 0 })}
          </span>
          <span className="text-muted-foreground font-medium">
            {driver._count?.laps || 0} {t('glossary:lap', { count: driver._count?.laps || 0 })}
          </span>
          {driver.bestLap && (
            <span className="flex items-center gap-1">
              {t('common:record')} <LapTime time={driver.bestLap} size="sm" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
