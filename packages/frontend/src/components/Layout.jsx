import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import AppSidebar from './AppSidebar'
import BackendStatusPopup from './BackendStatusPopup'
import PageHeader from './layout/PageHeader'
import StatusFooter from './layout/StatusFooter'
import { useBackendHealth } from './layout/useBackendHealth'
import { useApp } from '../context/AppContext'
import { PageHeaderProvider } from '../context/PageHeaderContext'

/** The app's frame: sidebar, page header, the page, the device footer and the server status sheet. */
export default function Layout() {
  const { sidebarOpen, setSidebarOpen } = useApp()
  const backend = useBackendHealth()
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar
        backendConnected={backend.connected}
        backendVersion={backend.version}
        onStatusClick={() => setStatusPopupOpen(true)}
      />
      <SidebarInset>
        <PageHeaderProvider>
          <header
            data-testid="page-header"
            className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-4 py-1.5"
          >
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-5" />
            <PageHeader />
          </header>

          <div data-testid="page-content" className="flex-1 min-w-0 overflow-auto">
            <Outlet />
          </div>
        </PageHeaderProvider>

        <StatusFooter />
      </SidebarInset>

      <BackendStatusPopup isOpen={statusPopupOpen} onClose={() => setStatusPopupOpen(false)} />
    </SidebarProvider>
  )
}
