import { Flag } from 'lucide-react'

/** Who did not finish, by name or controller. */
export default function SessionDnfList({ entries }) {
  const dnf = entries.filter((e) => e.isDNF)
  if (dnf.length === 0) return null
  return (
    <div className="flex items-center gap-2 text-sm text-orange-500" data-testid="session-dnf">
      <Flag className="size-4" />
      DNF : {dnf.map((e) => e.driver?.name || `Ctrl ${e.controller + 1}`).join(', ')}
    </div>
  )
}
