import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SessionLimitsFields from './SessionLimitsFields'
import { SESSION_TYPE_STYLE } from './sessionLimits'

// The name and limits of a session being created or edited
export default function SessionLimitsEditor({
  type,
  label,
  form,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmDisabled,
}) {
  const { t } = useTranslation('championships')
  const style = SESSION_TYPE_STYLE[type]
  return (
    <div data-testid="config-session-editor" className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge className={style.color}>{label}</Badge>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder={t(style.labelKey)}
          className="flex-1 h-7"
        />
        <Button
          size="sm"
          className="h-7"
          aria-label={confirmLabel ? undefined : t('common:save')}
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          <Check className="size-3.5" /> {confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" className="h-7" aria-label={t('common:cancel')} onClick={onCancel}>
          <X className="size-3.5" />
        </Button>
      </div>
      <SessionLimitsFields form={form} onChange={onChange} />
    </div>
  )
}
