import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Flag, FlaskConical, Scale } from 'lucide-react'
import { SessionStatus, SessionType } from '@racehubos/shared'

const TYPE_ICONS = {
  [SessionType.PRACTICE]: FlaskConical,
  [SessionType.QUALIF]: Clock,
  [SessionType.RACE]: Flag,
  [SessionType.BALANCING]: Scale,
}

const STATUS_STYLES = {
  [SessionStatus.ACTIVE]: { color: 'bg-green-100 text-green-700', pulse: true },
  [SessionStatus.PAUSED]: { color: 'bg-yellow-100 text-yellow-700' },
  [SessionStatus.FINISHING]: { color: 'bg-orange-100 text-orange-700', pulse: true },
  [SessionStatus.FINISHED]: { color: 'bg-muted text-muted-foreground' },
}
const DRAFT_STYLE = { color: 'bg-yellow-100 text-yellow-700' }

/** The session's type, label and name (renamed in place while a draft), and its status. */
export default function SessionHeader({ session, label, canEdit, onSaveConfig }) {
  const { t } = useTranslation('championships')
  const [editing, setEditing] = useState(false)
  const nameRef = useRef(null)
  const typeName = t(`glossary:sessionTypeFull.${session.type}`)

  function startEditing() {
    if (!canEdit) return
    setEditing(true)
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  async function save(text) {
    setEditing(false)
    const name = text.trim() || null
    if (name === (session.name || null)) return
    try {
      await onSaveConfig({ name })
    } catch (err) {
      console.error('Failed to save name:', err)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
    }
    if (e.key === 'Escape') {
      e.target.textContent = session.name || typeName
      setEditing(false)
    }
  }

  const TypeIcon = TYPE_ICONS[session.type] || Flag
  const status = STATUS_STYLES[session.status] || DRAFT_STYLE
  const statusKey = STATUS_STYLES[session.status] ? session.status : SessionStatus.DRAFT

  return (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <TypeIcon className="w-5 h-5 text-muted-foreground shrink-0" />
        <h2
          data-testid="session-title"
          className="font-semibold text-foreground flex flex-wrap items-center gap-1 min-w-0 break-words"
        >
          {label && `${label} - `}
          {editing ? (
            <span
              ref={nameRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => save(e.target.textContent)}
              onKeyDown={handleKeyDown}
              className="outline-none cursor-text"
            >
              {session.name || typeName}
            </span>
          ) : (
            <span
              onClick={startEditing}
              className={canEdit ? 'cursor-text hover:text-muted-foreground transition-colors' : ''}
            >
              {session.name || typeName}
            </span>
          )}
        </h2>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}
        >
          {t(`sessionSection.status.${statusKey}`)}
        </span>
      </div>
    </div>
  )
}
