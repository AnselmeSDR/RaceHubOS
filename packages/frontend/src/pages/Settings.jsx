import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useDevice, SIMULATOR_ADDRESS } from '../context/DeviceContext'
import { useTheme } from '../context/ThemeContext'
import {
  ArrowLeftIcon,
  WifiIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  SignalIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

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

  // Logs
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)

  const addLogEntry = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-99), { time: timestamp, message }])
  }

  // Socket for logs
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

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Handle device connection
  async function handleConnect(address) {
    const result = await connect(address)
    if (result.success) {
      addLogEntry(`Connecté à ${address === SIMULATOR_ADDRESS ? 'Simulateur' : address}`)
    } else {
      addLogEntry(`Erreur: ${result.error}`)
    }
  }

  // Handle scan
  async function handleScan() {
    addLogEntry('Scan en cours...')
    const foundDevices = await scan(15000)
    addLogEntry(`${foundDevices.length} appareil(s) trouvé(s)`)
  }

  // Handle delete
  async function handleDelete(device) {
    const result = await removeDevice(device.id)
    if (result.success) {
      addLogEntry(`Device ${device.name} supprimé`)
    } else {
      addLogEntry(`Erreur: ${result.error}`)
    }
  }

  // Merge devices from DB with scan results (avoid duplicates)
  // Filter out simulator if not admin
  const allDevices = [...devices].filter(d => isAdmin || d.type !== 'simulator')
  for (const scanDevice of scanResults) {
    if (!allDevices.find(d => d.address === scanDevice.address)) {
      // Skip simulator in scan results if not admin
      if (!isAdmin && scanDevice.type === 'simulator') continue
      allDevices.push({
        ...scanDevice,
        isNew: true, // Mark as not yet in DB
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Retour</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Paramètres</h1>

          {/* Connection Status Banner */}
          <div className={`mb-8 p-4 rounded-lg flex items-center justify-between ${
            connected ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-500'}`} />
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">
                  {connected
                    ? `Connecté: ${deviceAddress === SIMULATOR_ADDRESS ? 'Simulateur' : deviceAddress}`
                    : 'Aucun appareil connecté'}
                </p>
              </div>
            </div>
            {connected && (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Déconnecter
              </button>
            )}
          </div>

          {/* Device Selection */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <WifiIcon className="h-6 w-6 text-blue-500" />
              Sélectionner un appareil
            </h2>

            <div className="space-y-2">
              {allDevices.map((device) => (
                <div
                  key={device.id || device.address}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    connected && deviceAddress === device.address
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : device.isNew
                        ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SignalIcon className={`h-6 w-6 ${device.type === 'simulator' ? 'text-purple-500' : 'text-blue-500'}`} />
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {device.name}
                        {device.isNew && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(nouveau)</span>}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{device.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connected && deviceAddress === device.address ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-500" />
                    ) : (
                      <button
                        onClick={() => handleConnect(device.address)}
                        disabled={connecting || connected}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm"
                      >
                        {connecting ? 'Connexion...' : 'Connecter'}
                      </button>
                    )}
                    {device.type !== 'simulator' && (
                      <button
                        onClick={() => handleDelete(device)}
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        title="Supprimer"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleScan}
              disabled={scanning || connected}
              className="mt-4 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {scanning && <ArrowPathIcon className="h-5 w-5 animate-spin" />}
              {scanning ? 'Recherche en cours...' : 'Rechercher un nouveau circuit'}
            </button>
          </div>

          {/* CU Status (when connected) */}
          {connected && cuStatus && (
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <CpuChipIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                État du Device
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Start</p>
                  <p className="font-mono dark:text-gray-200">{cuStatus.start}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Mode</p>
                  <p className="font-mono dark:text-gray-200">{cuStatus.mode || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Display</p>
                  <p className="font-mono dark:text-gray-200">{cuStatus.display || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Fuel</p>
                  <p className="font-mono dark:text-gray-200">{cuStatus.fuel?.join(', ') || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Appearance */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              {isDark ? <MoonIcon className="h-6 w-6 text-blue-500" /> : <SunIcon className="h-6 w-6 text-yellow-500" />}
              Apparence
            </h2>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Mode {isDark ? 'nuit' : 'jour'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDark ? 'Interface sombre pour réduire la fatigue oculaire' : 'Interface claire pour une meilleure lisibilité'}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  isDark ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                    isDark ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Admin */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <CpuChipIcon className="h-6 w-6 text-purple-500" />
              Admin
            </h2>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Mode administrateur</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Afficher les pages Displays, Test et Simulateur
                </p>
              </div>
              <button
                onClick={toggleAdmin}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  isAdmin ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                    isAdmin ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
              <h3 className="text-sm font-semibold">Logs</h3>
              <button
                onClick={() => setLogs([])}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
                Effacer
              </button>
            </div>
            <div className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun log</p>
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
      </div>
    </div>
  )
}
