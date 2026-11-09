import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** Where the running add-on action stands, or why it failed. */
export default function AddonProgress({ progress, onDismiss }) {
  const { t } = useTranslation('addons')
  if (!progress) return null

  const addon = progress.addon ?? t('progress.newAddon')
  const title = t(`progress.${progress.action}`, { addon })

  if (progress.status === 'error') {
    return (
      <Card className="border-destructive/50" data-testid="addon-progress" data-status="error">
        <CardContent className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-destructive break-words">{t('progress.failed', { error: progress.error })}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss} aria-label={t('progress.dismiss')}>
            <X className="size-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-500/50" data-testid="addon-progress" data-status={progress.status}>
      <CardContent className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-blue-500 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">
            {progress.status === 'complete' ? t('progress.restarting') : t(`step.${progress.step}`)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
