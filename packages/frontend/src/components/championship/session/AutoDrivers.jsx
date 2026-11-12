import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import { CONTROLLER_COLORS } from '@/lib/colors'
import DriverAvatar from '@/components/driver/DriverAvatar'

/**
 * A session of an automatic championship, set by the server: its drivers once it runs, or for a
 * race still without any, that they come from the qualifying.
 */
export default function AutoDrivers({ session, entries, canEdit }) {
  const { t } = useTranslation('championships')

  if (!canEdit && entries.length > 0) {
    return (
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          {entries.map((sd) => (
            <div key={sd.id} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-full px-2.5 py-1">
              <span
                className={`inline-flex items-center justify-center size-4 rounded-full text-white text-[10px] font-bold ${CONTROLLER_COLORS[sd.controller]}`}
              >
                {sd.controller + 1}
              </span>
              {sd.driver?.img && <DriverAvatar driver={sd.driver} className="size-4" />}
              <span className="font-medium">{sd.driver?.name || '?'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (session.type === SessionType.RACE && entries.length === 0) {
    return (
      <div className="px-4 py-4 border-b border-border text-center">
        <p className="text-sm text-muted-foreground italic">{t('sessionSection.autoAssignWait')}</p>
      </div>
    )
  }
  return null
}
