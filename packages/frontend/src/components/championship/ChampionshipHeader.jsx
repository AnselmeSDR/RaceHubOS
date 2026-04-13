import { Settings, Clock, Flag, FlaskConical, PanelRightClose, PanelRightOpen, Trophy, GitBranch, Zap, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SESSION_COLORS, STATUS_DOTS } from '../../lib/colors'

const SESSION_TYPES = {
  practice: { label: 'EL', color: `${SESSION_COLORS.practice.bg} ${SESSION_COLORS.practice.text}`, icon: FlaskConical },
  qualif: { label: 'Q', color: `${SESSION_COLORS.qualif.bg} ${SESSION_COLORS.qualif.text}`, icon: Clock },
  race: { label: 'R', color: `${SESSION_COLORS.race.bg} ${SESSION_COLORS.race.text}`, icon: Flag }
}

export default function ChampionshipHeader({
  championship,
  sessions = [],
  selectedSession,
  onSelectSession,
  onConfig,
  onFinish,
  showStandings,
  onToggleStandings,
  showBracket,
  onToggleBracket,
  showResults,
  onSelectResults,
}) {
  const getSessionLabel = (session) => {
    if (session.type === 'practice') return 'EL'
    const sameType = sessions.filter(s => s.type === session.type)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const index = sameType.findIndex(s => s.id === session.id) + 1
    return `${session.type === 'qualif' ? 'Q' : 'R'}${index}`
  }

  const getStatusDot = (session) => STATUS_DOTS[session.status] || null

  const isFinished = championship?.status === 'finished'
  const qrSessions = sessions.filter(s => s.type === 'qualif' || s.type === 'race')
  const allSessionsFinished = qrSessions.length > 0 && qrSessions.every(s => s.status === 'finished')
  const canFinish = allSessionsFinished && !isFinished

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
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">{championship?.name || 'Championnat'}</h1>
            {championship?.mode === 'auto' && (
              <Badge className="bg-primary/10 text-primary text-[10px] py-0 px-1.5">
                <Zap className="size-2.5 mr-0.5" />
                Auto
              </Badge>
            )}
          </div>
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
                  isSelected && !showResults
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

          {/* Results tab */}
          <button
            onClick={onSelectResults}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              showResults
                ? 'bg-championship/15 text-championship ring-2 ring-championship/30'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Award className="size-3.5" />
            Résultats
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {isFinished && (
          <Badge className="bg-muted text-muted-foreground">Terminé</Badge>
        )}
        {canFinish && (
          <Button size="sm" onClick={onFinish} className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Trophy className="size-3.5" />
            Terminer le championnat
          </Button>
        )}
        {championship?.mode === 'auto' && (
          <button onClick={onToggleBracket} className={`p-1.5 rounded transition-colors ${showBracket ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} title={showBracket ? 'Masquer le bracket' : 'Afficher le bracket'}>
            <GitBranch className="size-4" />
          </button>
        )}
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
