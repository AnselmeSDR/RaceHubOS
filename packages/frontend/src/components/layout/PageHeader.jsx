import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutGridIcon, ListIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePageHeader } from '@/context/PageHeaderContext'
import { allNavItems, findNavItem, navLabel } from '@/lib/navItems'

function useDefaultPageTitle() {
  const { t } = useTranslation('layout')
  const { pathname } = useLocation()
  const item = findNavItem(allNavItems, pathname)
  return item ? navLabel(t, item) : 'RaceHubOS'
}

/** The page's title, or the one its header context sets with its count, view toggle and add button. */
export default function PageHeader() {
  const { t } = useTranslation('layout')
  const { header } = usePageHeader()
  const defaultTitle = useDefaultPageTitle()

  if (!header) {
    return <h1 className="text-sm font-medium">{defaultTitle}</h1>
  }

  return (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        {header.icon && (
          <div
            className={`size-7 bg-${header.color}-100 dark:bg-${header.color}-900/30 rounded-lg flex items-center justify-center shrink-0`}
          >
            <span className={`text-${header.color}-600 dark:text-${header.color}-400 [&_svg]:size-4`}>
              {header.icon}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-medium break-words leading-tight">{header.title}</h1>
          <p className="text-xs text-muted-foreground leading-tight">
            {header.loading
              ? '...'
              : header.totalCount != null
                ? t('header.results', { count: header.totalCount })
                : ''}
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {header.hasGrid && (
          <Tabs value={header.viewMode} onValueChange={header.onViewModeChange}>
            <TabsList>
              <TabsTrigger value="grid" data-testid="view-grid">
                <LayoutGridIcon className="w-4 h-4" />
                {t('common:grid')}
              </TabsTrigger>
              <TabsTrigger value="list" data-testid="view-list">
                <ListIcon className="w-4 h-4" />
                {t('common:list')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {header.onAdd && (
          <Button
            data-testid="page-add"
            size="sm"
            onClick={header.onAdd}
            className={`bg-${header.color}-500 hover:bg-${header.color}-600 text-white`}
          >
            {header.icon}
            {header.addLabel}
          </Button>
        )}
      </div>
    </>
  )
}
