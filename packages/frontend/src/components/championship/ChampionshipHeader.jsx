import { Settings, Clock, Flag, FlaskConical, PanelRightClose, PanelRightOpen } from 'lucide-react'

const SESSION_TYPES = {
  practice: { label: 'EL', color: 'bg-purple-500/15 text-purple-600', icon: FlaskConical },
  qualif: { label: 'Q', color: 'bg-blue-500/15 text-blue-600', icon: Clock },
  race: { label: 'R', color: 'bg-green-500/15 text-green-600', icon: Flag }
}

export default function ChampionshipHeader({
  championship,
  sessions = [],
  selectedSession,
  onSelectSession,
  onConfig,
  showStandings,
  onToggleStandings,
}) {
  const getSessionLabel = (session) => {
    if (session.type === 'practice') return 'EL'
    const sameType = sessions.filter(s => s.type === session.type)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const index = sameType.findIndex(s => s.id === session.id) + 1
    return `${session.type === 'qualif' ? 'Q' : 'R'}${index}`
  }

  const getStatusDot = (session) => {
    if (session.status === 'active') return 'bg-green-500 animate-pulse'
    if (session.status === 'finishing') return 'bg-orange-500 animate-pulse'
    if (session.status === 'finished') return 'bg-muted-foreground/50'
    return null
  }

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.type === 'practice') return -1
    if (b.type === 'practice') return 1
    if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0)
    return new Date(a.createdAt) - new Date(b.createdAt)
  })

  return (
    <div className="border-b px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-sm font-semibold">{championship?.name || 'Championnat'}</h1>
          <p className="text-xs text-muted-foreground">{championship?.track?.name || 'Circuit non défini'}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {sortedSessions.map(session => {
            const config = SESSION_TYPES[session.type]
            const isSelected = selectedSession?.id === session.id
            const Icon = config.icon
            const dot = getStatusDot(session)

            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={`relative flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? `${config.color} ring-2 ring-current/30`
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="size-3.5" />
                {getSessionLabel(session)}
                {dot && <span className={`absolute -top-0.5 -right-0.5 size-2 rounded-full ${dot}`} />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onToggleStandings} className="p-1.5 hover:bg-muted rounded transition-colors" title={showStandings ? 'Masquer le classement' : 'Afficher le classement'}>
          {showStandings ? <PanelRightClose className="size-4 text-muted-foreground" /> : <PanelRightOpen className="size-4 text-muted-foreground" />}
        </button>
        <button onClick={onConfig} className="p-1.5 hover:bg-muted rounded transition-colors" title="Configuration">
          <Settings className="size-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
