import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

/** Any git repository: not reviewed, so the user is told what that means first. */
export default function InstallFromLink({ busy, onInstall }) {
  const { t } = useTranslation('addons')
  const [repo, setRepo] = useState('')
  const link = repo.trim()

  return (
    <Card>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (link) onInstall(link)
          }}
        >
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span data-testid="link-warning">{t('link.warning')}</span>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t('link.label')}</span>
            <Input
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder={t('link.placeholder')}
              data-testid="link-repo"
            />
          </label>
          <Button type="submit" size="sm" disabled={busy || !link} data-testid="link-install">
            <Download className="size-4" />
            {t('link.install')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
