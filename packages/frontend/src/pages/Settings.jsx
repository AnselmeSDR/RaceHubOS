import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  WifiIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Settings() {
  const [bluetoothDevices, setBluetoothDevices] = useState([])
  const [scanning, setScanning] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [useMockDevice, setUseMockDevice] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const response = await fetch(`${API_URL}/settings`)
      const data = await response.json()
      if (data.success) {
        setUseMockDevice(data.data.useMockDevice || false)
        setSelectedDevice(data.data.connectedDevice || null)
        setConnectionStatus(data.data.connectionStatus || 'disconnected')
      }
    } catch (error) {
      // Error loading settings
    }
  }

  async function scanForDevices() {
    // Check if Web Bluetooth API is available
    if (!navigator.bluetooth) {
      alert('Web Bluetooth n\'est pas supporté par ce navigateur. Utilisez Chrome ou Edge.')
      return
    }

    setScanning(true)
    try {
      // Request Bluetooth device using Web Bluetooth API
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service'] // Add services if needed
      })

      // Device selected, add to list
      const newDevice = {
        id: device.id,
        name: device.name || 'Appareil sans nom'
      }

      // Check if device already in list
      if (!bluetoothDevices.find(d => d.id === device.id)) {
        setBluetoothDevices([...bluetoothDevices, newDevice])
      }

      // Auto-connect to the selected device
      await connectToDevice(newDevice)
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        // User didn't cancel, real error
        // Error scanning for devices
      }
    } finally {
      setScanning(false)
    }
  }

  async function connectToDevice(device) {
    setConnecting(true)
    setSelectedDevice(device)

    // If it's a Web Bluetooth device, we need to reconnect using the device ID
    if (!device.bluetoothDevice && navigator.bluetooth) {
      try {
        // For Web Bluetooth, we can't reconnect to a device by ID
        // The user needs to select it again through requestDevice
        setConnectionStatus('connected')
        setUseMockDevice(false)

        // Save to backend for persistence
        await fetch(`${API_URL}/settings/bluetooth-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device })
        })
      } catch (error) {
        setConnectionStatus('failed')
      }
    } else {
      // Mock device connection
      try {
        const response = await fetch(`${API_URL}/bluetooth/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: device.id })
        })
        const data = await response.json()
        if (data.success) {
          setConnectionStatus('connected')
          setUseMockDevice(false)
        } else {
          setConnectionStatus('failed')
        }
      } catch (error) {
        // Error connecting to device
        setConnectionStatus('failed')
      }
    }

    setConnecting(false)
  }

  async function disconnectDevice() {
    try {
      const response = await fetch(`${API_URL}/bluetooth/disconnect`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        setConnectionStatus('disconnected')
        setSelectedDevice(null)
      }
    } catch (error) {
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
    } catch (error) {
      // Error toggling mock device
      setUseMockDevice(!newValue) // Revert on error
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
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
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
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
          </div>

          {/* Connexion Bluetooth */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <WifiIcon className="h-6 w-6 text-blue-500" />
              Connexion Circuit Carrera
            </h2>

            {/* État de connexion actuel */}
            {selectedDevice && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{selectedDevice.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {connectionStatus === 'connected' && (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Connecté</span>
                        </>
                      )}
                      {connectionStatus === 'failed' && (
                        <>
                          <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">Échec de connexion</span>
                        </>
                      )}
                      {connectionStatus === 'disconnected' && (
                        <>
                          <XMarkIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Déconnecté</span>
                        </>
                      )}
                    </div>
                  </div>
                  {connectionStatus === 'connected' && (
                    <button
                      onClick={disconnectDevice}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Déconnecter
                    </button>
                  )}
                </div>
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
              {scanning ? 'Recherche en cours...' : 'Rechercher des appareils Bluetooth'}
            </button>

            {/* Liste des appareils trouvés */}
            {bluetoothDevices.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Appareils trouvés :</h3>
                {bluetoothDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{device.name || 'Appareil inconnu'}</p>
                      <p className="text-xs text-gray-500">{device.id}</p>
                    </div>
                    <button
                      onClick={() => connectToDevice(device)}
                      disabled={connecting}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        connecting
                          ? 'bg-gray-200 text-gray-400'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {connecting && selectedDevice?.id === device.id ? 'Connexion...' : 'Connecter'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Info pour AppConnect */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Circuit compatible :</h3>
              <p className="text-sm text-blue-800">
                Carrera Digital 132/124 avec AppConnect (Réf. 30369)
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Assurez-vous que le circuit est allumé et que le Bluetooth est activé.
              </p>
            </div>

            {/* Info HTTPS */}
            {typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="font-medium text-amber-900 mb-1">⚠️ HTTPS requis</h3>
                <p className="text-sm text-amber-800">
                  Le Bluetooth Web nécessite une connexion sécurisée (HTTPS).
                  Utilisez https:// ou localhost pour accéder au Bluetooth.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}