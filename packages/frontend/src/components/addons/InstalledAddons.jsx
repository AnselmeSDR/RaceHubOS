import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpCircle, Power, PowerOff, Puzzle, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { addonDescription, addonName } from './addonText'
import UninstallDialog from './UninstallDialog'

function Status({ addon }) {
  const { t } = useTranslation('addons')
  if (!addon.valid) return <Badge variant="destructive">{t('installed.invalid')}</Badge>
  if (!addon.enabled) return <Badge variant="secondary">{t('installed.disabled')}</Badge>
  return <Badge className="bg-green-600 text-white">{t('installed.enabled')}</Badge>
}

function AddonCard({ addon, busy, onAction, onUninstall }) {
  const { t, i18n } = useTranslation('addons')
  const lang = i18n.resolvedLanguage
  const { manifest, installed } = addon
  const source = installed?.source ?? 'local'

  return (
    <Card data-testid={`addon-${addon.id}`}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="size-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <Puzzle className="size-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{addonName(addon, lang)}</h3>
              {manifest?.version && (
                <span className="font-mono text-xs text-muted-foreground">v{manifest.version}</span>
              )}
              <Status addon={addon} />
              <Badge variant="outline">{t(`installed.source.${source}`)}</Badge>
            </div>
            {manifest?.author && (
              <p className="text-xs text-muted-foreground">{t('installed.by', { author: manifest.author })}</p>
            )}
            {addonDescription(addon, lang) && <p className="text-sm mt-1">{addonDescription(addon, lang)}</p>}
          </div>
        </div>

        {!addon.valid && <p className="text-sm text-destructive">{addon.errors.join(' · ')}</p>}
        {addon.valid && addon.disabledReason && (
          <p className="text-sm text-muted-foreground" data-testid="addon-disabled-reason">
            {t('installed.disabledReason', { reason: addon.disabledReason })}
          </p>
        )}
        {!installed && <p className="text-xs text-muted-foreground">{t('installed.localHint')}</p>}

        <div className="flex flex-wrap gap-2">
          {addon.update && (
            <Button size="sm" disabled={busy} onClick={() => onAction('update', { id: addon.id })}>
              <ArrowUpCircle className="size-4" />
              {t('installed.update', { ref: addon.update.ref })}
            </Button>
          )}
          {addon.valid &&
            (addon.enabled ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('disable', { id: addon.id })}>
                <PowerOff className="size-4" />
                {t('installed.disable')}
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('enable', { id: addon.id })}>
                <Power className="size-4" />
                {t('installed.enable')}
              </Button>
            ))}
          {installed && (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={onUninstall}>
              <Trash2 className="size-4" />
              {t('installed.uninstall')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** The add-ons in addons/, with what can be done with each. */
export default function InstalledAddons({ addons, busy, onAction }) {
  const { t, i18n } = useTranslation('addons')
  const [uninstalling, setUninstalling] = useState(null)

  if (addons.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t('installed.empty')}</p>
  }

  return (
    <div className="space-y-3">
      {addons.map((addon) => (
        <AddonCard
          key={addon.id}
          addon={addon}
          busy={busy}
          onAction={onAction}
          onUninstall={() => setUninstalling(addon)}
        />
      ))}
      {uninstalling && (
        <UninstallDialog
          name={addonName(uninstalling, i18n.resolvedLanguage)}
          onClose={() => setUninstalling(null)}
          onConfirm={({ deleteData }) => {
            setUninstalling(null)
            onAction('uninstall', { id: uninstalling.id, deleteData })
          }}
        />
      )}
    </div>
  )
}
