import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useFetch } from '@/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AddonMarket from '@/components/addons/AddonMarket'
import AddonProgress from '@/components/addons/AddonProgress'
import InstallFromLink from '@/components/addons/InstallFromLink'
import InstalledAddons from '@/components/addons/InstalledAddons'
import OverrideStacks from '@/components/addons/OverrideStacks'
import { MANAGER_URL, startAddonAction } from '@/components/addons/api'
import { useAddonProgress } from '@/components/addons/useAddonProgress'

/** Add-ons: installed ones, the market and install from a link — docs/ADDONS.md § For the user. */
export default function Addons() {
  const { t } = useTranslation('addons')
  const { data, error, refetch } = useFetch(MANAGER_URL)
  const { progress, setProgress } = useAddonProgress()
  const busy = progress?.status === 'running' || progress?.status === 'complete'

  // A failed action may have changed something (an add-on disabled again): show it as it is
  const failed = progress?.status === 'error'
  useEffect(() => {
    if (failed) refetch()
  }, [failed, refetch])

  async function run(action, params) {
    try {
      const { addon } = await startAddonAction(action, params)
      setProgress({ action, addon, step: 'starting', status: 'running' })
    } catch (err) {
      setProgress({ action, addon: params.id ?? null, step: 'error', status: 'error', error: err.message })
    }
  }

  // On `data`, not `loading`: a request aborted by the next one ends its loading before data arrives
  if (!data) {
    if (error) return <p className="p-4 text-destructive">{t('page.loadError', { error })}</p>
    return (
      <div className="p-8 flex justify-center" data-testid="addons-loading">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <AddonProgress progress={progress} onDismiss={() => setProgress(null)} />
      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed" data-testid="addons-tab-installed">
            {t('tabs.installed')}
          </TabsTrigger>
          <TabsTrigger value="market" data-testid="addons-tab-market">
            {t('tabs.market')}
          </TabsTrigger>
          <TabsTrigger value="link" data-testid="addons-tab-link">
            {t('tabs.link')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="installed" className="space-y-4">
          <InstalledAddons addons={data.addons} busy={busy} onAction={run} />
          <OverrideStacks overrides={data.overrides} />
        </TabsContent>
        <TabsContent value="market">
          <AddonMarket catalog={data.catalog} busy={busy} onInstall={(id) => run('install', { id })} />
        </TabsContent>
        <TabsContent value="link">
          <InstallFromLink busy={busy} onInstall={(repo) => run('install', { repo })} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
