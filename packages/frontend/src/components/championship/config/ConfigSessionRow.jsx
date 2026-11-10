import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { SessionStatus } from '@racehubos/shared'
import { Badge } from '@/components/ui/badge'
import { SESSION_TYPE_STYLE, limitsText } from './sessionLimits'

// A scheduled session; only a draft can be moved, edited or deleted
export default function ConfigSessionRow({ session, label, first, last, locked, onMove, onEdit, onDelete }) {
  const { t } = useTranslation('championships')
  const style = SESSION_TYPE_STYLE[session.type]
  const Icon = style.icon
  const draft = session.status === SessionStatus.DRAFT
  return (
    <div data-testid="config-session-row" className="flex items-center gap-2">
      {draft && (
        <div className="flex flex-col">
          <button
            aria-label={t('configModal.moveUp')}
            onClick={() => onMove('up')}
            disabled={locked || first}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            aria-label={t('configModal.moveDown')}
            onClick={() => onMove('down')}
            disabled={locked || last}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      )}

      <Badge className={style.color}>{label}</Badge>
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="font-medium text-sm flex-1">{session.name || t(style.labelKey)}</span>
      <span className="text-xs text-muted-foreground">{limitsText(session)}</span>
      {draft ? (
        <>
          <button
            aria-label={t('common:edit')}
            onClick={onEdit}
            disabled={locked}
            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted disabled:opacity-20"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            aria-label={t('common:delete')}
            onClick={onDelete}
            disabled={locked}
            className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 disabled:opacity-20"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      ) : (
        <Badge variant="outline" className="text-[10px]">
          {t(`configModal.sessionStatus.${session.status}`, session.status)}
        </Badge>
      )}
    </div>
  )
}
