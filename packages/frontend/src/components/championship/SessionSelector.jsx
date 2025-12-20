import { ChevronDownIcon, ClockIcon, FlagIcon, CheckCircleIcon, PlayCircleIcon } from '@heroicons/react/24/outline'

/**
 * SessionSelector - Dropdown to select a session from a championship
 * Displays sessions as "Q1", "Q2", "R1", "R2" etc based on type and order
 */
export default function SessionSelector({ sessions = [], selectedSession, onSelect }) {
  // Group sessions by type and assign numbers
  const formatSessionLabel = (session, index, allSessions) => {
    const sameTypeSessions = allSessions
      .filter(s => s.type === session.type)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    const orderIndex = sameTypeSessions.findIndex(s => s.id === session.id) + 1
    const prefix = session.type === 'qualifying' ? 'Q' : session.type === 'race' ? 'R' : 'P'

    return `${prefix}${orderIndex}`
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
      case 'running':
        return {
          icon: PlayCircleIcon,
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          label: 'En cours'
        }
      case 'finished':
      case 'completed':
        return {
          icon: CheckCircleIcon,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: 'Terminee'
        }
      case 'planned':
      case 'draft':
      default:
        return {
          icon: ClockIcon,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          label: 'Planifiee'
        }
    }
  }

  const getTypeIcon = (type) => {
    return type === 'race' ? FlagIcon : ClockIcon
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-lg">
        Aucune session
      </div>
    )
  }

  const selectedLabel = selectedSession
    ? formatSessionLabel(selectedSession, 0, sessions)
    : 'Selectionner...'

  return (
    <div className="relative">
      <select
        value={selectedSession?.id || ''}
        onChange={(e) => {
          const session = sessions.find(s => s.id === e.target.value)
          onSelect(session)
        }}
        className="appearance-none w-full pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-yellow-500 focus:border-transparent cursor-pointer"
      >
        <option value="">Selectionner une session...</option>
        {sessions.map((session, index) => {
          const label = formatSessionLabel(session, index, sessions)
          const statusConfig = getStatusConfig(session.status)
          const sessionName = session.name ? ` - ${session.name}` : ''

          return (
            <option key={session.id} value={session.id}>
              {label}{sessionName} ({statusConfig.label})
            </option>
          )
        })}
      </select>
      <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
    </div>
  )
}
