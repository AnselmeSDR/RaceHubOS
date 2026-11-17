import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import ApplicationPanel from '@/components/settings/ApplicationPanel'
import ControlUnitPanel from '@/components/settings/ControlUnitPanel'
import ReferenceDriverSettings from '@/components/settings/ReferenceDriverSettings'
import VoiceSettings from '@/components/settings/VoiceSettings'

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
    // Two columns once there is room: a control is never far from what it sets
    <div className="@container p-4">
      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-2">
        <div className="space-y-4">
          <ControlUnitPanel logs={logs} onLog={addLogEntry} onClearLogs={() => setLogs([])} />
          <ReferenceDriverSettings />
          <ApplicationPanel />
        </div>
        <div className="space-y-4">
          <AppearanceSettings />
          <VoiceSettings />
        </div>
      </div>
    </div>
  )
}
