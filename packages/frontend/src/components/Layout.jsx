import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { LayoutGridIcon, ListIcon } from 'lucide-react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AppSidebar, { allNavItems } from './AppSidebar'
import BackendStatusPopup from './BackendStatusPopup'
import { useDevice, SIMULATOR_ADDRESS } from '../context/DeviceContext'
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext'

const API_URL = import.meta.env.VITE_API_URL || ''

const CU_STATE_NAMES = {
  0: 'Racing',
  1: 'Lights 1/5',
  2: 'Lights 2/5',
  3: 'Lights 3/5',
  4: 'Lights 4/5',
  5: 'Lights 5/5',
  6: 'False Start',
  7: 'Go!',
  8: 'Stopped',
  9: 'Stopped'
}

function useDefaultPageTitle() {
  const { pathname } = useLocation()
  const basePath = '/' + (pathname.split('/')[1] || '')
  const item = allNavItems.find(n =>
    n.to === '/' ? pathname === '/' : basePath === n.to
  )
  return item?.label ?? 'RaceHubOS'
}

function PageHeader() {
  const { header } = usePageHeader()
  const defaultTitle = useDefaultPageTitle()

  if (!header) {
    return <h1 className="text-sm font-medium">{defaultTitle}</h1>
  }

  return (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        {header.icon && (
          <div className={`size-7 bg-${header.color}-100 dark:bg-${header.color}-900/30 rounded-lg flex items-center justify-center shrink-0`}>
            <span className={`text-${header.color}-600 dark:text-${header.color}-400 [&_svg]:size-4`}>{header.icon}</span>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-sm font-medium truncate leading-tight">{header.title}</h1>
          <p className="text-xs text-muted-foreground leading-tight">
            {header.loading ? '...' : header.totalCount != null ? `${header.totalCount} résultat${header.totalCount > 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {header.hasGrid && (
          <Tabs value={header.viewMode} onValueChange={header.onViewModeChange}>
            <TabsList>
              <TabsTrigger value="grid">
                <LayoutGridIcon className="w-4 h-4" />
                Grille
              </TabsTrigger>
              <TabsTrigger value="list">
                <ListIcon className="w-4 h-4" />
                Liste
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {header.onAdd && (
          <Button
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

export default function Layout() {
  const { cuStatus, connected: cuConnected, deviceAddress, lastTimer } = useDevice()
  const isSimulator = deviceAddress === SIMULATOR_ADDRESS
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)
  const [backendConnected, setBackendConnected] = useState(true)
  const [backendVersion, setBackendVersion] = useState('0.1.0')

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/health`)
        const data = await res.json()
        setBackendConnected(data.status === 'ok')
        setBackendVersion(data.version || '0.1.0')
      } catch {
        setBackendConnected(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar
        backendConnected={backendConnected}
        backendVersion={backendVersion}
        onStatusClick={() => setStatusPopupOpen(true)}
      />
      <SidebarInset>
        <PageHeaderProvider>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-full" />
            <PageHeader />
          </header>

          <div className="flex-1 overflow-auto [contain:inline-size]">
            <Outlet />
          </div>
        </PageHeaderProvider>

        <footer className="flex h-8 shrink-0 items-center gap-1 border-t px-4 text-xs font-mono text-muted-foreground">
          <div className={`size-1.5 rounded-full ${cuConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={cuConnected ? (isSimulator ? 'text-purple-400' : 'text-green-500') : 'text-red-500'}>
            {cuConnected ? (isSimulator ? 'SIMULATOR' : 'CU') : 'NO CU'}
          </span>
          <span className="text-muted-foreground/40 mx-1">|</span>
          <span className={cuStatus?.start === 0 ? 'text-green-500' : cuStatus?.start >= 1 && cuStatus?.start <= 7 ? 'text-yellow-500' : 'text-muted-foreground'}>
            {CU_STATE_NAMES[cuStatus?.start] || 'Unknown'}
          </span>
          <span className="text-muted-foreground/40 mx-1">|</span>
          <span>Mode {cuStatus?.mode ?? '-'}</span>
          {lastTimer && (
            <>
              <span className="text-muted-foreground/40 mx-1">|</span>
              <span className="text-blue-400">C{lastTimer.controller + 1}</span>
              <span className="text-green-500 ml-1">{(lastTimer.lapTime / 1000).toFixed(3)}s</span>
            </>
          )}
        </footer>
      </SidebarInset>

      <BackendStatusPopup
        isOpen={statusPopupOpen}
        onClose={() => setStatusPopupOpen(false)}
      />
    </SidebarProvider>
  )
}
