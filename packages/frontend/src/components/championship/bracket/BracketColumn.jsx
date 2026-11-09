import BracketCard from './BracketCard'

/** A column of groups under its title, each opening its session when clicked. */
export default function BracketColumn({ title, titleColor, groups, type, onSessionSelect }) {
  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-semibold ${titleColor}`}>{title}</h3>
      {groups.map((group) => (
        <button key={group.sessionId} className="w-full text-left" onClick={() => onSessionSelect?.(group.sessionId)}>
          <BracketCard group={group} type={type} />
        </button>
      ))}
    </div>
  )
}
