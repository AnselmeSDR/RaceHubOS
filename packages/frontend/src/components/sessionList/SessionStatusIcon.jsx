import { CheckCircle, Clock, Play } from 'lucide-react'
import { SessionStatus } from '@racehubos/shared'

/** A draft, running or finished session's icon; none for the other statuses. */
export default function SessionStatusIcon({ status }) {
  if (status === SessionStatus.DRAFT) return <Clock className="h-4 w-4 text-gray-500" />
  if (status === SessionStatus.ACTIVE) return <Play className="h-4 w-4 text-green-500 animate-pulse" />
  if (status === SessionStatus.FINISHED) return <CheckCircle className="h-4 w-4 text-blue-500" />
  return null
}
