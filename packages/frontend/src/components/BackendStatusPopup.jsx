import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { Server, Zap, Wifi, WifiOff, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const API_URL = import.meta.env.VITE_API_URL || ''
const WS_URL = import.meta.env.VITE_WS_URL || ''

const LOG_TYPES = ['info', 'warn', 'error', 'debug']

const LOG_COLORS = {
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  debug: 'text-muted-foreground',
}

function cuStateLabel(t, start) {
  if (start === 0) return t('cuState.racing')
  if (start >= 1 && start <= 5) return t('cuState.lights', { n: start })
  if (start === 6) return t('cuState.falseStart')
  if (start === 7) return t('cuState.go')
  if (start === 8 || start === 9) return t('cuState.stopped')
  return t('footer.unknown')
}

export default function BackendStatusPopup({ isOpen, onClose }) {
  const { t } = useTranslation('layout')
  const [backendStatus, setBackendStatus] = useState(null)
  const [cuStatus, setCuStatus] = useState(null)
  const [simulatorStatus, setSimulatorStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const logsEndRef = useRef(null)
  const logsContainerRef = useRef(null)
  const socketRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const fetchStatus = async () => {
      setLoading(true)
      try {
        const [healthRes, btRes, simRes] = await Promise.all([
          fetch(`${API_URL}/health`),
          fetch(`${API_URL}/api/bluetooth/status`),
          fetch(`${API_URL}/api/simulator`)
        ])
        const [health, bt, sim] = await Promise.all([
          healthRes.json(), btRes.json(), simRes.json()
        ])
        setBackendStatus(health)
        setCuStatus(bt)
        setSimulatorStatus(sim)
        addLog('info', t('statusPopup.logs.backendStatus', { status: health.status, version: health.version }))
        if (sim.isMockDevice) {
          addLog('info', t('statusPopup.logs.simulatorMode', { state: sim.running ? t('glossary:status.running') : t('glossary:status.stopped') }))
        } else if (bt.connected) {
          addLog('info', t('statusPopup.logs.cuConnected'))
        } else {
          addLog('warn', t('statusPopup.logs.cuNotConnected'))
        }
      } catch (error) {
        addLog('error', t('statusPopup.logs.backendError', { message: error.message }))
        setBackendStatus(null)
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [isOpen, t])

  useEffect(() => {
    if (!isOpen) return
    const socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true })
    socketRef.current = socket

    socket.on('connect', () => addLog('info', t('statusPopup.logs.wsConnected')))
    socket.on('disconnect', () => addLog('warn', t('statusPopup.logs.wsDisconnected')))
    socket.on('cu:connected', () => addLog('info', t('statusPopup.logs.cuConnected')))
    socket.on('cu:disconnected', () => addLog('warn', t('statusPopup.logs.cuDisconnected')))
    socket.on('cu:status', (status) => {
      addLog('debug', t('statusPopup.logs.cuStatus', { state: cuStateLabel(t, status.start), mode: status.mode }))
    })
    socket.on('cu:timer', (data) => addLog('debug', t('statusPopup.logs.timer', {
      kind: data.isFinishLine ? t('statusPopup.logs.timerFinish') : t('statusPopup.logs.timerSector', { sector: data.sector }),
      controller: data.controller,
      lapTime: data.lapTime,
    })))
    socket.on('lap:completed', (lap) => addLog('info', t('statusPopup.logs.lap', {
      label: lap.driver?.name || `Ctrl ${lap.controller}`,
      time: (lap.lapTime / 1000).toFixed(3),
    })))
    socket.on('session:started', ({ sessionId }) => addLog('info', t('statusPopup.logs.sessionStarted', { id: sessionId.substring(0, 8) })))
    socket.on('session:stopped', ({ sessionId }) => addLog('info', t('statusPopup.logs.sessionStopped', { id: sessionId.substring(0, 8) })))
    return () => socket.disconnect()
  }, [isOpen, t])

  const handleScroll = () => {
    if (!logsContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  useEffect(() => {
    if (autoScroll) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const addLog = (level, message) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false })
    setLogs(prev => [...prev, { timestamp, level, message }])
  }

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  const statusItems = [
    {
      label: t('statusPopup.status.backend'),
      icon: Server,
      ok: !!backendStatus,
      detail: backendStatus ? `v${backendStatus.version}` : t('glossary:status.disconnected'),
    },
    {
      label: simulatorStatus?.isMockDevice ? t('glossary:simulator') : t('glossary:system.controlUnit'),
      icon: Zap,
      ok: simulatorStatus?.isMockDevice ? simulatorStatus.running : cuStatus?.connected,
      detail: simulatorStatus?.isMockDevice
        ? (simulatorStatus.running ? t('glossary:status.running') : t('glossary:status.stopped'))
        : (cuStatus?.connected ? t('glossary:status.connected') : t('glossary:status.disconnected')),
    },
    {
      label: t('glossary:system.websocket'),
      icon: socketRef.current?.connected ? Wifi : WifiOff,
      ok: socketRef.current?.connected,
      detail: socketRef.current?.connected ? t('glossary:status.connected') : t('glossary:status.disconnected'),
    },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-3xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Server className="size-4 text-blue-500" />
            {t('statusPopup.title')}
          </SheetTitle>
          <SheetDescription>
            {backendStatus ? `v${backendStatus.version}` : '...'} · {simulatorStatus?.isMockDevice ? t('glossary:simulator') : t('statusPopup.cuBluetooth')}
          </SheetDescription>
        </SheetHeader>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-2 px-4">
          {statusItems.map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`size-1.5 rounded-full ${s.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs font-medium truncate">{s.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>

        {/* Log toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-y border-border">
          <span className="text-xs text-muted-foreground">{t('statusPopup.logsCount', { count: filteredLogs.length })}</span>
          <div className="flex items-center gap-1.5">
            {['all', ...LOG_TYPES].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? t('statusPopup.filterAll') : f}
              </button>
            ))}
            <Button variant="ghost" size="icon-sm" onClick={() => { setLogs([]); addLog('info', t('statusPopup.logsCleared')) }} title={t('common:clear')}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>

        {/* Logs */}
        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto px-4 py-2 font-mono text-[11px] bg-muted/30"
        >
          {loading ? (
            <p className="text-muted-foreground text-center py-8">{t('statusPopup.loading')}</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('statusPopup.noLogs')}</p>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground/60 shrink-0">{log.timestamp}</span>
                <span className={`shrink-0 uppercase w-10 ${LOG_COLORS[log.level]}`}>[{log.level}]</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
