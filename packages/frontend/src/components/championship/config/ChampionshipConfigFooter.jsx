import { useTranslation } from 'react-i18next'
import { Flag, RefreshCw } from 'lucide-react'
import { ChampionshipStatus } from '@racehubos/shared'
import { Button } from '@/components/ui/button'

// A finished championship can be reopened; a running one finished
export default function ChampionshipConfigFooter({ championship, saving, onReopen, onFinish, onClose, onSave }) {
  const { t } = useTranslation('championships')
  const finished = championship?.status === ChampionshipStatus.FINISHED
  return (
    <div
      data-testid="championship-config-footer"
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border"
    >
      {finished ? (
        <Button variant="outline" size="sm" onClick={onReopen}>
          <RefreshCw className="size-3.5" />
          {t('configModal.reopenChampionship')}
        </Button>
      ) : onFinish ? (
        <Button variant="destructive" size="sm" onClick={onFinish}>
          <Flag className="size-3.5" />
          {t('configModal.finishChampionship')}
        </Button>
      ) : (
        <div />
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onClose}>
          {t('common:close')}
        </Button>
        <Button onClick={onSave} disabled={saving || finished}>
          {saving ? t('common:saving') : t('common:save')}
        </Button>
      </div>
    </div>
  )
}
