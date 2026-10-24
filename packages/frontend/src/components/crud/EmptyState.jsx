import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}) {
  const { t } = useTranslation('common')
  return (
    <div className="text-center py-16 bg-muted/50 rounded-2xl border-2 border-dashed border-border">
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-medium text-foreground mb-1">{title ?? t('emptyState.title')}</h3>
      <p className="text-muted-foreground mb-6">{message ?? t('emptyState.message')}</p>

      {onAction && (
        <Button onClick={onAction}>
          <Plus className="size-4" />
          {actionLabel ?? t('add')}
        </Button>
      )}
    </div>
  )
}
