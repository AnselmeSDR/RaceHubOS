import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useDevice, SIMULATOR_ADDRESS } from '../context/DeviceContext'
import { useTheme } from '../context/ThemeContext'
import {
  Wifi,
  Cpu,
  CheckCircle,
  RefreshCw,
  Trash2,
  Radio,
  Sun,
  Moon,
  Shield,
  LayoutGrid,
  List,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const WS_URL = import.meta.env.VITE_WS_URL || ''

export default function Settings() {
  const {
    connected,
    deviceAddress,
    devices,
    scanResults,
    cuStatus,
    scanning,
    connecting,
    scan,
    connect,
    disconnect,
    removeDevice,
  } = useDevice()
  const { isDark, toggleTheme, isAdmin, toggleAdmin } = useTheme()

  const [defaultViewMode, setDefaultViewMode] = useState('grid')
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)

  const addLogEntry = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-99), { time: timestamp, message }])
  }

  useEffect(() => {
    fetch(`${API_URL}/api/preferences/viewMode:default`).then(r => r.json()).then(d => {
      if (d.success && d.data) setDefaultViewMode(d.data)
    }).catch(() => {})
  }, [])

  function handleDefaultViewChange(mode) {
    setDefaultViewMode(mode)
    fetch(`${API_URL}/api/preferences/viewMode:default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: mode }),
    }).catch(() => {})
  }

  useEffect(() => {
    const socket = io(WS_URL)

    socket.on('race:lap', (data) => {
      addLogEntry(`Voiture ${data.carId} - Tour ${data.lapNumber}: ${(data.lapTime / 1000).toFixed(3)}s`)
    })

    socket.on('cu:timer', (data) => {
      if (data.lapTime > 0) {
        addLogEntry(`Controller ${data.controller + 1}: ${(data.lapTime / 1000).toFixed(3)}s`)
      }
    })

    return () => socket.disconnect()
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function handleConnect(address) {
    const result = await connect(address)
    addLogEntry(result.success
      ? `Connecté à ${address === SIMULATOR_ADDRESS ? 'Simulateur' : address}`
      : `Erreur: ${result.error}`)
  }

  async function handleScan() {
    addLogEntry('Scan en cours...')
    const foundDevices = await scan(15000)
    addLogEntry(`${foundDevices.length} appareil(s) trouvé(s)`)
  }

  async function handleDelete(device) {
    const result = await removeDevice(device.id)
    addLogEntry(result.success ? `Device ${device.name} supprimé` : `Erreur: ${result.error}`)
  }

  const allDevices = [...devices].filter(d => isAdmin || d.type !== 'simulator')
  for (const scanDevice of scanResults) {
    if (!allDevices.find(d => d.address === scanDevice.address)) {
      if (!isAdmin && scanDevice.type === 'simulator') continue
      allDevices.push({ ...scanDevice, isNew: true })
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Connection Status */}
      <Card className={connected ? 'border-green-500/50' : ''}>
        <CardContent className=" flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`size-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
            <p className="font-medium text-sm">
              {connected
                ? `Connecté: ${deviceAddress === SIMULATOR_ADDRESS ? 'Simulateur' : deviceAddress}`
                : 'Aucun appareil connecté'}
            </p>
          </div>
          {connected && (
            <Button variant="destructive" size="sm" onClick={disconnect}>Déconnecter</Button>
          )}
        </CardContent>
      </Card>

      {/* Device Selection */}
      <Card>
        <CardContent className="">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Wifi className="size-4 text-blue-500" />
            Sélectionner un appareil
          </h2>

          <div className="space-y-2">
            {allDevices.map((device) => (
              <div
                key={device.id || device.address}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  connected && deviceAddress === device.address
                    ? 'border-green-500/50 bg-green-500/10'
                    : device.isNew
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-border hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Radio className={`size-4 ${device.type === 'simulator' ? 'text-purple-500' : 'text-blue-500'}`} />
                  <div>
                    <p className="font-medium text-sm">
                      {device.name}
                      {device.isNew && <span className="ml-2 text-xs text-blue-500">(nouveau)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{device.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connected && deviceAddress === device.address ? (
                    <CheckCircle className="size-5 text-green-500" />
                  ) : (
                    <Button size="sm" onClick={() => handleConnect(device.address)} disabled={connecting || connected}>
                      {connecting ? 'Connexion...' : 'Connecter'}
                    </Button>
                  )}
                  {device.type !== 'simulator' && (
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(device)} title="Supprimer">
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full mt-3" onClick={handleScan} disabled={scanning || connected}>
            {scanning && <RefreshCw className="size-4 animate-spin" />}
            {scanning ? 'Recherche en cours...' : 'Rechercher un nouveau circuit'}
          </Button>
        </CardContent>
      </Card>

      {/* CU Status */}
      {connected && cuStatus && (
        <Card>
          <CardContent className="">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Cpu className="size-4 text-muted-foreground" />
              État du Device
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Start', value: cuStatus.start },
                { label: 'Mode', value: cuStatus.mode || '-' },
                { label: 'Display', value: cuStatus.display || '-' },
                { label: 'Fuel', value: cuStatus.fuel?.join(', ') || '-' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-mono">{s.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appearance & Admin */}
      <Card>
        <CardContent className=" space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="size-4 text-blue-500" /> : <Sun className="size-4 text-yellow-500" />}
              <div>
                <p className="font-medium text-sm">Mode {isDark ? 'nuit' : 'jour'}</p>
                <p className="text-xs text-muted-foreground">
                  {isDark ? 'Interface sombre' : 'Interface claire'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? 'bg-blue-600' : 'bg-muted'}`}
            >
              <span className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {defaultViewMode === 'grid' ? <LayoutGrid className="size-4 text-green-500" /> : <List className="size-4 text-green-500" />}
              <div>
                <p className="font-medium text-sm">Vue par défaut</p>
                <p className="text-xs text-muted-foreground">
                  {defaultViewMode === 'grid' ? 'Grille' : 'Liste'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDefaultViewChange(defaultViewMode === 'grid' ? 'list' : 'grid')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${defaultViewMode === 'grid' ? 'bg-green-600' : 'bg-muted'}`}
            >
              <span className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${defaultViewMode === 'grid' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="size-4 text-purple-500" />
              <div>
                <p className="font-medium text-sm">Mode administrateur</p>
                <p className="text-xs text-muted-foreground">Displays, Test, Simulateur</p>
              </div>
            </div>
            <button
              onClick={toggleAdmin}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAdmin ? 'bg-purple-600' : 'bg-muted'}`}
            >
              <span className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${isAdmin ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <h3 className="text-sm font-semibold">Logs</h3>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
            <Trash2 className="size-3" />
            Effacer
          </Button>
        </div>
        <div className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-muted/30">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun log</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="text-muted-foreground">[{log.time}]</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </Card>
    </div>
  )
}
