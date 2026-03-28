import { useState, useEffect, useRef } from 'react'
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

export default function BackendStatusPopup({ isOpen, onClose }) {
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
        addLog('info', `Backend: ${health.status} (v${health.version})`)
        if (sim.isMockDevice) {
          addLog('info', `Mode simulateur: ${sim.running ? 'En cours' : 'Arrêté'}`)
        } else if (bt.connected) {
          addLog('info', 'CU connecté')
        } else {
          addLog('warn', 'CU non connecté')
        }
      } catch (error) {
        addLog('error', `Erreur connexion backend: ${error.message}`)
        setBackendStatus(null)
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true })
    socketRef.current = socket

    socket.on('connect', () => addLog('info', 'WebSocket connecté'))
    socket.on('disconnect', () => addLog('warn', 'WebSocket déconnecté'))
    socket.on('cu:connected', () => addLog('info', 'CU connecté'))
    socket.on('cu:disconnected', () => addLog('warn', 'CU déconnecté'))
    socket.on('cu:status', (status) => {
      const names = { 0: 'Racing', 1: 'Lights 1/5', 2: 'Lights 2/5', 3: 'Lights 3/5', 4: 'Lights 4/5', 5: 'Lights 5/5', 6: 'False Start', 7: 'Go!', 9: 'Stopped' }
      addLog('debug', `CU Status: ${names[status.start] || `State ${status.start}`}, Mode: ${status.mode}`)
    })
    socket.on('cu:timer', (data) => addLog('debug', `Timer: Ctrl ${data.controller} - ${data.lapTime}ms`))
    socket.on('lap:completed', (lap) => addLog('info', `Tour: ${lap.driver?.name || `Ctrl ${lap.controller}`} - ${(lap.lapTime / 1000).toFixed(3)}s`))
    socket.on('session:started', ({ sessionId }) => addLog('info', `Session démarrée: ${sessionId.substring(0, 8)}...`))
    socket.on('session:stopped', ({ sessionId }) => addLog('info', `Session arrêtée: ${sessionId.substring(0, 8)}...`))
    socket.on('race:lap', (data) => addLog('debug', `Sim Lap: Car ${data.carId} - ${(data.lapTime / 1000).toFixed(3)}s`))

    return () => socket.disconnect()
  }, [isOpen])

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
      label: 'Backend',
      icon: Server,
      ok: !!backendStatus,
      detail: backendStatus ? `v${backendStatus.version}` : 'Déconnecté',
    },
    {
      label: simulatorStatus?.isMockDevice ? 'Simulateur' : 'Control Unit',
      icon: Zap,
      ok: simulatorStatus?.isMockDevice ? simulatorStatus.running : cuStatus?.connected,
      detail: simulatorStatus?.isMockDevice
        ? (simulatorStatus.running ? 'En cours' : 'Arrêté')
        : (cuStatus?.connected ? 'Connecté' : 'Déconnecté'),
    },
    {
      label: 'WebSocket',
      icon: socketRef.current?.connected ? Wifi : WifiOff,
      ok: socketRef.current?.connected,
      detail: socketRef.current?.connected ? 'Connecté' : 'Déconnecté',
    },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-3xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Server className="size-4 text-blue-500" />
            Status Backend
          </SheetTitle>
          <SheetDescription>
            {backendStatus ? `v${backendStatus.version}` : '...'} · {simulatorStatus?.isMockDevice ? 'Simulateur' : 'CU Bluetooth'}
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
          <span className="text-xs text-muted-foreground">Logs ({filteredLogs.length})</span>
          <div className="flex items-center gap-1.5">
            {['all', ...LOG_TYPES].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? 'Tout' : f}
              </button>
            ))}
            <Button variant="ghost" size="icon-sm" onClick={() => { setLogs([]); addLog('info', 'Logs effacés') }} title="Effacer">
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
            <p className="text-muted-foreground text-center py-8">Chargement...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun log</p>
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
