import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Server } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import LogList from './backendStatus/LogList'
import LogToolbar from './backendStatus/LogToolbar'
import StatusCards from './backendStatus/StatusCards'
import { statusItems } from './backendStatus/statusLog'
import { useBackendStatus } from './backendStatus/useBackendStatus'

/** The server, device and socket states and a live log of server events, in a side sheet. */
export default function BackendStatusPopup({ isOpen, onClose }) {
  const { t } = useTranslation('layout')
  const status = useBackendStatus(isOpen)
  const [filter, setFilter] = useState('all')
  const shownLogs = filter === 'all' ? status.logs : status.logs.filter((l) => l.level === filter)

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-3xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Server className="size-4 text-blue-500" />
            {t('statusPopup.title')}
          </SheetTitle>
          <SheetDescription>
            {status.health ? `v${status.health.version}` : '...'} ·{' '}
            {status.simulator?.isMockDevice ? t('glossary:simulator') : t('statusPopup.cuBluetooth')}
          </SheetDescription>
        </SheetHeader>
        <StatusCards items={statusItems(t, status)} />
        <LogToolbar count={shownLogs.length} filter={filter} onFilterChange={setFilter} onClear={status.clearLogs} />
        <LogList logs={shownLogs} loading={status.loading} />
      </SheetContent>
    </Sheet>
  )
}
