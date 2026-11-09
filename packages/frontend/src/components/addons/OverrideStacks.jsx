import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileCode } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Core files changed by add-ons: each stack from the top layer down to the core, and the
 * one real conflict, a layer that replaces the file — docs/ADDONS.md § Stacking.
 */
export default function OverrideStacks({ overrides }) {
  const { t } = useTranslation('addons')
  const { stacks, replacements, orphans } = overrides
  if (stacks.length === 0 && orphans.length === 0) return null

  const warnings = [
    ...replacements.map((r) =>
      r.hides.length > 0
        ? t('overrides.replacement', { addon: r.id, file: r.file, hidden: r.hides.join(', ') })
        : t('overrides.replacementAlone', { addon: r.id, file: r.file })
    ),
    ...orphans.map((o) => t('overrides.orphan', { addon: o.id, file: o.file })),
  ]

  return (
    <Card data-testid="override-stacks">
      <CardContent className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <FileCode className="size-4 text-violet-500" />
          {t('overrides.title')}
        </h2>
        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => (
              <p key={warning} className="flex items-start gap-2" data-testid="override-warning">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                {warning}
              </p>
            ))}
            {replacements.some((r) => r.hides.length > 0) && <p className="text-xs">{t('overrides.hint')}</p>}
          </div>
        )}
        {stacks.map((stack) => (
          <div key={stack.file} className="text-sm">
            <p className="font-mono text-xs break-all">{stack.file}</p>
            <p className="text-muted-foreground">
              {[...stack.layers].reverse().join(' → ')} → {t('overrides.core')}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
