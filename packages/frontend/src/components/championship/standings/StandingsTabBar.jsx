import { useTranslation } from 'react-i18next'
import { Clock, Flag, FlaskConical } from 'lucide-react'
import { STANDARD_SESSION_TYPES, SessionType, sessionTypeFullKey, sessionTypeKey } from '@racehubos/shared'

const TAB_STYLE = {
  [SessionType.PRACTICE]: {
    icon: FlaskConical,
    active: 'text-purple-600 border-purple-600',
    idle: 'text-muted-foreground hover:text-purple-600',
  },
  [SessionType.QUALIF]: {
    icon: Clock,
    active: 'text-blue-600 border-blue-600',
    idle: 'text-muted-foreground hover:text-blue-600',
  },
  [SessionType.RACE]: {
    icon: Flag,
    active: 'text-green-600 border-green-600',
    idle: 'text-muted-foreground hover:text-green-600',
  },
}

// One tab per session type; the short label when the panel is narrow
export default function StandingsTabBar({ activeTab, onTabChange }) {
  const { t } = useTranslation('championships')
  return (
    <div role="tablist" className="flex border-b border-border">
      {STANDARD_SESSION_TYPES.map((id) => {
        const { icon: Icon, active, idle } = TAB_STYLE[id]
        const isActive = activeTab === id
        const label = t(sessionTypeFullKey(id))
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(id)}
            title={label}
            className={`flex-1 min-w-0 px-2 py-3 text-xs font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
              isActive ? `${active} border-b-2 bg-muted/50` : `${idle} hover:bg-muted`
            }`}
          >
            <Icon className="hidden @xs:block w-4 h-4 shrink-0" />
            <span className="hidden @md:inline truncate">{label}</span>
            <span className="@md:hidden truncate">{t(sessionTypeKey(id))}</span>
          </button>
        )
      })}
    </div>
  )
}
