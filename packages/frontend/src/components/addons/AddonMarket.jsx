import { useTranslation } from 'react-i18next'
import { Check, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { addonDescription, addonName } from './addonText'

const isWebLink = (repo) => /^https?:\/\//.test(repo)

/** The add-ons the maintainer reviewed (addons/catalog.json), installed in one click. */
export default function AddonMarket({ catalog, busy, onInstall }) {
  const { t, i18n } = useTranslation('addons')
  const lang = i18n.resolvedLanguage

  return (
    <div className="space-y-3">
      {catalog.source !== 'remote' && <p className="text-sm text-muted-foreground">{t('market.offline')}</p>}
      {catalog.addons.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('market.empty')}</p>
      )}
      {catalog.addons.map((entry) => (
        <Card key={entry.id} data-testid={`market-${entry.id}`}>
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{addonName(entry, lang)}</h3>
              {addonDescription(entry, lang) && <p className="text-sm">{addonDescription(entry, lang)}</p>}
              {isWebLink(entry.repo) && (
                <a
                  href={entry.repo}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline"
                >
                  {t('market.source')}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {entry.installed ? (
              <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                <Check className="size-4" />
                {t('market.installed')}
              </span>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => onInstall(entry.id)}>
                <Download className="size-4" />
                {t('market.install')}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
