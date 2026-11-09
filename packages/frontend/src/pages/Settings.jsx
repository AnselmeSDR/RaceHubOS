import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import ConnectionLogs from '@/components/settings/ConnectionLogs'
import ConnectionStatus from '@/components/settings/ConnectionStatus'
import CuStatusCard from '@/components/settings/CuStatusCard'
import DeviceList from '@/components/settings/DeviceList'
import ReferenceDriverSettings from '@/components/settings/ReferenceDriverSettings'
import UpdateSection from '@/components/settings/UpdateSection'

const WS_URL = import.meta.env.VITE_WS_URL || ''

export default function Settings() {
  const { t } = useTranslation('settings')
  const [logs, setLogs] = useState([])

  const addLogEntry = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev.slice(-99), { time: timestamp, message }])
  }

  useEffect(() => {
    const socket = io(WS_URL)

    socket.on('cu:timer', (data) => {
      if (data.isFinishLine && data.lapTime > 0) {
        addLogEntry(t('logs.controllerLap', { n: data.controller + 1, time: (data.lapTime / 1000).toFixed(3) }))
      } else if (!data.isFinishLine) {
        addLogEntry(t('logs.controllerSector', { n: data.controller + 1, sector: data.sector }))
      }
    })

    return () => socket.disconnect()
  }, [t])

  return (
    <div className="p-4 space-y-4">
      <UpdateSection />
      <ConnectionStatus />
      <DeviceList onLog={addLogEntry} />
      <CuStatusCard />
      <AppearanceSettings />
      <ReferenceDriverSettings />
      <ConnectionLogs logs={logs} onClear={() => setLogs([])} />
    </div>
  )
}
