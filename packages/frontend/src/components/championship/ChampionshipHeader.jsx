import {
  Cog6ToothIcon,
  ClockIcon,
  FlagIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'

const SESSION_TYPES = {
  practice: { label: 'EL', color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700', icon: BeakerIcon },
  qualif: { label: 'Q', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700', icon: ClockIcon },
  race: { label: 'R', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700', icon: FlagIcon }
}

/**
 * ChampionshipHeader - Header section for championship detail page
 * Displays: Championship name | Circuit | Config button
 * Session buttons: [EL] [Q1] [Q2] [R1] [R2]
 */
export default function ChampionshipHeader({
  championship,
  sessions = [],
  selectedSession,
  onSelectSession,
  onConfig
}) {
  // Get session label (EL, Q1, Q2, R1, R2, etc.)
  const getSessionLabel = (session) => {
    if (session.type === 'practice') return 'EL'
    const sameType = sessions.filter(s => s.type === session.type)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const index = sameType.findIndex(s => s.id === session.id) + 1
    const prefix = session.type === 'qualif' ? 'Q' : 'R'
    return `${prefix}${index}`
  }

  // Get status indicator for session button
  const getStatusIndicator = (session) => {
    switch (session.status) {
      case 'active':
        return <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      case 'finishing':
        return <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
      case 'finished':
        return <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gray-400 rounded-full" />
      default:
        return null
    }
  }

  // Sort sessions: practice first, then by order, then by creation date
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.type === 'practice') return -1
    if (b.type === 'practice') return 1
    // Sort by order first, then by createdAt
    if ((a.order ?? 0) !== (b.order ?? 0)) {
      return (a.order ?? 0) - (b.order ?? 0)
    }
    return new Date(a.createdAt) - new Date(b.createdAt)
  })

  return (
    <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
      {/* Main header row */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{championship?.name || 'Championnat'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{championship?.track?.name || 'Circuit non defini'}</p>
          </div>
        </div>

        <button
          onClick={onConfig}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Configuration du championnat"
        >
          <Cog6ToothIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Sessions row */}
      <div className="px-6 pb-4 flex items-center gap-2 flex-wrap">
        {/* Session buttons */}
        {sortedSessions.map(session => {
          const config = SESSION_TYPES[session.type]
          const isSelected = selectedSession?.id === session.id
          const Icon = config.icon

          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                isSelected
                  ? `${config.color} border-2 shadow-sm`
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {getSessionLabel(session)}
              {getStatusIndicator(session)}
            </button>
          )
        })}

      </div>
    </div>
  )
}
