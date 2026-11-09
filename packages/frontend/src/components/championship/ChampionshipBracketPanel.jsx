import ChampionshipBracket from './ChampionshipBracket'

/** The bracket of an automatic championship; picking a session in it selects that session. */
export default function ChampionshipBracketPanel({ championshipId, onSessionSelect }) {
  return (
    <div className="mb-4 bg-card border border-border rounded-xl p-4" data-testid="championship-bracket">
      <ChampionshipBracket championshipId={championshipId} onSessionSelect={onSessionSelect} />
    </div>
  )
}
