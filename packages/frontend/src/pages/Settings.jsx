import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import io from 'socket.io-client'
import {
  ArrowLeftIcon,
  WifiIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export default function Settings() {
  const [knownDevices, setKnownDevices] = useState([])
  const [scanning, setScanning] = useState(false)
  const [connectedDeviceId, setConnectedDeviceId] = useState(null)
  const [connecting, setConnecting] = useState(null) // ID du device en cours de connexion
  const [useMockDevice, setUseMockDevice] = useState(true)

  // Simulator state
  const [simulatorState, setSimulatorState] = useState(null)
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)
  const socketRef = useRef(null)

  // Helper to add log
  const addLogEntry = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-99), { time: timestamp, message }])
  }

  useEffect(() => {
    loadSettings()
    loadSimulatorState()

    // Connect to WebSocket for simulator events
    const socket = io(WS_URL)
    socketRef.current = socket

    socket.on('race:status', (data) => {
      setSimulatorState(prev => {
        const wasRunning = prev?.running
        const isNowRunning = data.running

        // Log state changes
        if (wasRunning !== isNowRunning) {
          if (isNowRunning) {
            addLogEntry('▶️ Simulateur démarré')
          } else {
            addLogEntry('⏹️ Simulateur arrêté')
          }
        }

        if (data.active !== prev?.active && wasRunning) {
          if (data.active) {
            addLogEntry('▶️ Course en cours')
          } else {
            addLogEntry('⏸️ Course en pause')
          }
        }

        return { ...prev, ...data }
      })
    })

    socket.on('race:lap', (data) => {
      addLogEntry(`🏁 Voiture ${data.carId} - Tour ${data.lapNumber}: ${(data.lapTime / 1000).toFixed(3)}s`)
    })

    socket.on('race:sector', (data) => {
      addLogEntry(`📍 Voiture ${data.carId} - Secteur ${data.sector}: ${(data.time / 1000).toFixed(3)}s`)
    })

    socket.on('race:pitStop', (data) => {
      addLogEntry(`🔧 Voiture ${data.carId} - Arrêt au stand: ${(data.duration / 1000).toFixed(1)}s`)
    })

    socket.on('race:carData', () => {
      // Optional: log car data periodically
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  async function loadSettings() {
    try {
      // Charger les paramètres généraux
      const response = await fetch(`${API_URL}/settings`)
      const data = await response.json()
      if (data.success) {
        setUseMockDevice(data.data.useMockDevice || false)
      }

      // Charger la liste des appareils connus
      const devicesResponse = await fetch(`${API_URL}/settings/known-devices`)
      const devicesData = await devicesResponse.json()
      if (devicesData.success) {
        setKnownDevices(devicesData.data || [])
      }

      // Charger l'état de connexion BT depuis le backend
      const btResponse = await fetch(`${API_URL}/bluetooth/status`)
      const btData = await btResponse.json()
      if (btData.connected) {
        setConnectedDeviceId('Control_Unit')
      } else {
        setConnectedDeviceId(null)
      }
    } catch {
      // Error loading settings
    }
  }

  async function scanForDevices() {
    setScanning(true)
    try {
      // Utiliser le backend pour scanner via Noble (avec auto-connect)
      const response = await fetch(`${API_URL}/bluetooth/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 15000, autoConnect: true })
      })
      const data = await response.json()

      if (data.success && data.address) {
        const device = {
          id: data.address,
          name: 'Control_Unit',
          address: data.address
        }

        // Ajouter aux appareils connus
        await fetch(`${API_URL}/settings/known-devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(device)
        })

        // Si auto-connecté, mettre à jour l'état
        if (data.connected) {
          setConnectedDeviceId(device.id)
          setUseMockDevice(false)
        }

        // Recharger la liste
        await loadSettings()
      } else {
        alert(data.error || 'Control Unit non trouvé. Assurez-vous que le circuit est allumé.')
      }
    } catch (error) {
      alert('Erreur de scan: ' + error.message)
    } finally {
      setScanning(false)
    }
  }

  async function connectToDevice(device) {
    setConnecting(device.id)

    try {
      // Connexion via le backend (Noble)
      const response = await fetch(`${API_URL}/bluetooth/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: device.address || device.id })
      })
      const data = await response.json()

      if (data.success) {
        setConnectedDeviceId(device.id)
        setUseMockDevice(false)

        // Mettre à jour la date de dernière connexion
        await fetch(`${API_URL}/settings/known-devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(device)
        })

        // Recharger la liste
        await loadSettings()
      } else {
        alert(data.error || 'Échec de connexion')
      }
    } catch (error) {
      alert('Erreur de connexion: ' + error.message)
    }

    setConnecting(null)
  }

  async function removeDevice(device) {
    try {
      // Si connecté, déconnecter d'abord
      if (connectedDeviceId === device.id) {
        await disconnectDevice()
      }

      await fetch(`${API_URL}/settings/known-devices/${encodeURIComponent(device.id)}`, {
        method: 'DELETE'
      })

      // Recharger la liste
      await loadSettings()
    } catch (error) {
      alert('Erreur de suppression: ' + error.message)
    }
  }

  async function disconnectDevice() {
    try {
      const response = await fetch(`${API_URL}/bluetooth/disconnect`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        setConnectedDeviceId(null)
      }
    } catch {
      // Error disconnecting device
    }
  }

  async function toggleMockDevice() {
    const newValue = !useMockDevice
    setUseMockDevice(newValue)
    try {
      const response = await fetch(`${API_URL}/settings/mock-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue })
      })
      const data = await response.json()
      if (!data.success) {
        setUseMockDevice(!newValue) // Revert on error
      }
    } catch {
      // Error toggling mock device
      setUseMockDevice(!newValue) // Revert on error
    }
  }

  async function loadSimulatorState() {
    try {
      const response = await fetch(`${API_URL}/simulator`)
      const data = await response.json()
      setSimulatorState(data)

      if (data.isMockDevice) {
        addLogEntry(`🔄 État: ${data.running ? 'En cours' : 'Arrêté'}, ${data.cars?.length || 0} voitures`)
      }
    } catch (error) {
      addLogEntry('❌ Erreur: ' + error.message)
    }
  }

  async function handleSimulatorControl(action) {
    try {
      const response = await fetch(`${API_URL}/simulator/${action}`, {
        method: 'POST'
      })
      const data = await response.json()
      addLogEntry(`✅ ${action}: ${data.status}`)
      loadSimulatorState()
    } catch (error) {
      addLogEntry(`❌ Erreur ${action}: ${error.message}`)
    }
  }

  function clearLogs() {
    setLogs([])
  }

  // Auto-scroll when logs change
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Retour au tableau de bord</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Paramètres</h1>

          {/* Mode Simulateur */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CpuChipIcon className="h-6 w-6 text-purple-500" />
              Mode Simulateur
            </h2>

            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
              <div>
                <p className="font-medium text-gray-800">Utiliser le simulateur</p>
                <p className="text-sm text-gray-600">
                  Active le simulateur de circuit pour tester l'application sans circuit physique
                </p>
              </div>
              <button
                onClick={toggleMockDevice}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useMockDevice ? 'bg-yellow-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useMockDevice ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Simulator Controls & Logs */}
            {useMockDevice && (
              <div className="space-y-4">
                {/* Controls */}
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                  <button
                    onClick={() => handleSimulatorControl('start')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <PlayIcon className="w-4 h-4" />
                    Démarrer
                  </button>
                  <button
                    onClick={() => handleSimulatorControl('pause')}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <PauseIcon className="w-4 h-4" />
                    Pause
                  </button>
                  <button
                    onClick={() => handleSimulatorControl('stop')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <StopIcon className="w-4 h-4" />
                    Stop
                  </button>

                  {simulatorState && (
                    <div className="ml-auto text-sm text-gray-700">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                        simulatorState.running ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          simulatorState.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`}></div>
                        {simulatorState.running ? 'En cours' : 'Arrêté'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Logs */}
                <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <h3 className="text-sm font-semibold">Logs du simulateur</h3>
                    <button
                      onClick={clearLogs}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                      Effacer
                    </button>
                  </div>
                  <div className="h-64 overflow-y-auto p-4 font-mono text-xs space-y-1">
                    {logs.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">Aucun log pour le moment...</p>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="flex gap-3">
                          <span className="text-gray-500">[{log.time}]</span>
                          <span>{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Connexion Bluetooth */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <WifiIcon className="h-6 w-6 text-blue-500" />
              Connexion Circuit Carrera
            </h2>

            {/* Liste des circuits connus */}
            {knownDevices.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Circuits enregistrés :</h3>
                <div className="space-y-2">
                  {knownDevices.map((device) => {
                    const isConnected = connectedDeviceId === device.id
                    const isConnecting = connecting === device.id

                    return (
                      <div
                        key={device.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          isConnected
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                          }`} />
                          <div>
                            <p className="font-medium text-gray-800">{device.name}</p>
                            <p className="text-xs text-gray-500">
                              {device.address}
                              {device.lastConnected && (
                                <span className="ml-2">
                                  · Dernière connexion: {new Date(device.lastConnected).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isConnected ? (
                            <>
                              <span className="flex items-center gap-1 text-sm text-green-600 mr-2">
                                <CheckCircleIcon className="h-4 w-4" />
                                Connecté
                              </span>
                              <button
                                onClick={disconnectDevice}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
                              >
                                Déconnecter
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => connectToDevice(device)}
                              disabled={isConnecting || connecting}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                isConnecting || connecting
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {isConnecting && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                              {isConnecting ? 'Connexion...' : 'Connecter'}
                            </button>
                          )}
                          <button
                            onClick={() => removeDevice(device)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Message si aucun circuit */}
            {knownDevices.length === 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                <p>Aucun circuit enregistré</p>
                <p className="text-sm mt-1">Cliquez sur le bouton ci-dessous pour rechercher un circuit</p>
              </div>
            )}

            {/* Bouton de scan */}
            <button
              onClick={scanForDevices}
              disabled={scanning}
              className={`mb-4 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                scanning
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {scanning && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {scanning ? 'Recherche en cours...' : 'Rechercher un nouveau circuit'}
            </button>

            {/* Info pour AppConnect */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Circuit compatible :</h3>
              <p className="text-sm text-blue-800">
                Carrera Digital 132/124 avec Control Unit
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Assurez-vous que le circuit est allumé et que le Bluetooth est activé sur votre Mac.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}