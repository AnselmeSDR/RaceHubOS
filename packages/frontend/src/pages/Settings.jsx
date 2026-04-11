import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useDevice, SIMULATOR_ADDRESS } from '../context/DeviceContext'
import { useApp } from '../context/AppContext'
import { useVoice } from '../context/VoiceContext'
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
  Volume2,
  Play,
  Download,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const API_URL = import.meta.env.VITE_API_URL || ''
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
  const { isDark, toggleTheme, isAdmin, toggleAdmin } = useApp()
  const { bestLapEnabled, saveBestLapEnabled, podiumEnabled, savePodiumEnabled, minLaps: bestLapVoiceMinLaps, saveMinLaps, voiceId: bestLapVoiceId, saveVoiceId, speak } = useVoice()
  const [voices, setVoices] = useState([])

  const [defaultViewMode, setDefaultViewMode] = useState('grid')
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)

  // Update state
  const [updateInfo, setUpdateInfo] = useState(null)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(null)

  const addLogEntry = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-99), { time: timestamp, message }])
  }

  useEffect(() => {
    fetch(`${API_URL}/api/preferences/viewMode:default`).then(r => r.json()).then(d => {
      if (d.success && d.data) setDefaultViewMode(d.data)
    }).catch(() => {})
    // Load current version
    fetch(`${API_URL}/api/health`).then(r => r.json()).then(d => {
      setUpdateInfo({ currentVersion: d.version })
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

  async function checkUpdate() {
    setChecking(true)
    try {
      const res = await fetch(`${API_URL}/api/update/check`)
      const data = await res.json()
      if (data.success) setUpdateInfo(data.data)
    } catch {
      setUpdateInfo({ error: 'Impossible de vérifier' })
    } finally {
      setChecking(false)
    }
  }

  async function applyUpdate() {
    setUpdating(true)
    setUpdateProgress({ step: 0, message: 'Démarrage...', status: 'running' })
    try {
      await fetch(`${API_URL}/api/update/apply`, { method: 'POST' })
    } catch {
      setUpdateProgress({ step: 0, message: 'Erreur de connexion', status: 'error' })
      setUpdating(false)
    }
  }

  // Listen for update progress via WebSocket
  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket', 'polling'] })
    socket.on('update:progress', (data) => {
      setUpdateProgress(data)
      if (data.status === 'complete') {
        // Server will restart, wait and reload
        setTimeout(() => {
          const tryReconnect = () => {
            fetch(`${API_URL}/api/health`).then(() => {
              window.location.reload()
            }).catch(() => {
              setTimeout(tryReconnect, 2000)
            })
          }
          tryReconnect()
        }, 3000)
      }
      if (data.status === 'error') {
        setUpdating(false)
      }
    })
    return () => socket.disconnect()
  }, [])

  function handleBestLapVoiceToggle() {
    saveBestLapEnabled(!bestLapEnabled)
  }

  function handlePodiumVoiceToggle() {
    savePodiumEnabled(!podiumEnabled)
  }

  const loadVoices = useCallback(() => {
    const allVoices = speechSynthesis.getVoices()
    const frVoices = allVoices.filter(v => v.lang.startsWith('fr'))
    setVoices(frVoices)
  }, [])

  useEffect(() => {
    loadVoices()
    speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [loadVoices])

  function handleVoiceChange(voiceURI) {
    saveVoiceId(voiceURI)
  }

  function testVoice() {
    speak('Meilleur tour, Anselme, 6,142 secondes')
  }

  function handleBestLapVoiceMinLaps(value) {
    saveMinLaps(value)
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
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
      {/* Update Section */}
      <Card>
        <CardContent>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Download className="size-4 text-blue-500" />
            Mise à jour
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Version actuelle</p>
                <p className="font-mono font-bold">{updateInfo?.currentVersion || '...'}</p>
              </div>
              <div className="flex items-center gap-2">
                {!updating && (
                  <Button variant="outline" size="sm" onClick={checkUpdate} disabled={checking}>
                    {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Vérifier
                  </Button>
                )}
              </div>
            </div>

            {updateInfo?.updateAvailable && !updating && (
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Nouvelle version disponible : v{updateInfo.latestVersion}
                  </p>
                </div>
                <Button size="sm" onClick={applyUpdate}>
                  <ArrowUpCircle className="size-4" />
                  Mettre à jour
                </Button>
              </div>
            )}

            {updateInfo && !updateInfo.updateAvailable && !updateInfo.error && !updating && (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="size-4" />
                L'application est à jour
              </p>
            )}

            {updateInfo?.error && !updating && (
              <p className="text-sm text-destructive">{updateInfo.error}</p>
            )}

            {updating && updateProgress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {updateProgress.status === 'running' && <Loader2 className="size-4 animate-spin text-blue-500" />}
                  {updateProgress.status === 'complete' && <CheckCircle className="size-4 text-green-500" />}
                  {updateProgress.status === 'error' && <span className="size-4 text-destructive">✕</span>}
                  <p className="text-sm">{updateProgress.message}</p>
                </div>
                {updateProgress.status === 'running' && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500 rounded-full" style={{ width: `${(updateProgress.step / 6) * 100}%` }} />
                  </div>
                )}
                {updateProgress.status === 'complete' && (
                  <p className="text-xs text-muted-foreground">Redémarrage en cours...</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
              <Volume2 className={`size-4 ${bestLapEnabled ? 'text-orange-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Annonce meilleur tour</p>
                <p className="text-xs text-muted-foreground">
                  Voix quand un nouveau record est établi
                </p>
              </div>
            </div>
            <button
              onClick={handleBestLapVoiceToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bestLapEnabled ? 'bg-orange-600' : 'bg-muted'}`}
            >
              <span className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${bestLapEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {bestLapEnabled && (
            <div className="flex items-center justify-between pl-7">
              <p className="text-sm text-muted-foreground">Tours minimum avant annonce</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBestLapVoiceMinLaps(bestLapVoiceMinLaps - 1)}
                  className="size-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted"
                >
                  -
                </button>
                <span className="w-8 text-center font-mono text-sm">{bestLapVoiceMinLaps}</span>
                <button
                  onClick={() => handleBestLapVoiceMinLaps(bestLapVoiceMinLaps + 1)}
                  className="size-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className={`size-4 ${podiumEnabled ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Annonce podium</p>
                <p className="text-xs text-muted-foreground">
                  Résultats vocaux en fin de session
                </p>
              </div>
            </div>
            <button
              onClick={handlePodiumVoiceToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${podiumEnabled ? 'bg-yellow-600' : 'bg-muted'}`}
            >
              <span className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${podiumEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {(bestLapEnabled || podiumEnabled) && (
            <div className="flex items-center gap-2 pl-7">
              <Select value={bestLapVoiceId || '_default'} onValueChange={(v) => handleVoiceChange(v === '_default' ? '' : v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Voix par défaut" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-52 overflow-y-auto">
                  <SelectItem value="_default">Voix par défaut</SelectItem>
                  {voices.map(v => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={testVoice}
                className="size-8 shrink-0 rounded border border-border flex items-center justify-center hover:bg-muted"
                title="Tester la voix"
              >
                <Play className="size-3.5" />
              </button>
            </div>
          )}

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
