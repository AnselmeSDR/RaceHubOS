import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export const SIMULATOR_ADDRESS = 'SIMULATOR'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  // Connection state
  const [connected, setConnected] = useState(false)
  const [deviceType, setDeviceType] = useState(null)
  const [deviceAddress, setDeviceAddress] = useState(null)

  // Devices from DB
  const [devices, setDevices] = useState([])

  // Scan results (temporary, not persisted)
  const [scanResults, setScanResults] = useState([])

  // CU/Simulator status
  const [cuStatus, setCuStatus] = useState({ start: 8 })
  const [lastTimer, setLastTimer] = useState(null)

  // Loading states
  const [scanning, setScanning] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Socket
  const socketRef = useRef(null)
  const [socketConnected, setSocketConnected] = useState(false)

  // Initialize socket and load state
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    socket.on('cu:connected', () => {
      setConnected(true)
    })

    socket.on('cu:disconnected', () => {
      setConnected(false)
      setDeviceType(null)
      setDeviceAddress(null)
    })

    socket.on('cu:status', (status) => {
      setCuStatus(status)
    })

    socket.on('cu:timer', (data) => {
      setLastTimer(data)
    })

    socket.on('cu:connection', (data) => {
      setConnected(data.status === 'connected')
      if (data.device) {
        setDeviceAddress(data.device.id)
      }
    })

    loadStatus()
    loadDevices()

    return () => {
      socket.disconnect()
    }
  }, [])

  // Load current connection status
  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/status`)
      const data = await response.json()

      setConnected(data.connected || false)
      setDeviceType(data.deviceType || null)
      setDeviceAddress(data.deviceAddress || null)
      setCuStatus(data.lastStatus || { start: 8 })
    } catch (error) {
      console.error('[DeviceContext] Error loading status:', error)
    }
  }, [])

  // Load devices from DB
  const loadDevices = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/devices`)
      const data = await response.json()
      if (data.success) {
        setDevices(data.data || [])
      }
    } catch (error) {
      console.error('[DeviceContext] Error loading devices:', error)
    }
  }, [])

  // Scan for BLE devices (returns temporary list, not persisted)
  const scan = useCallback(async (timeout = 10000) => {
    setScanning(true)
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout }),
      })
      const data = await response.json()

      if (data.success) {
        setScanResults(data.devices || [])
        return data.devices
      }
      return []
    } catch (error) {
      console.error('[DeviceContext] Scan error:', error)
      return []
    } finally {
      setScanning(false)
    }
  }, [])

  // Connect to a device (persisted to DB on success by backend)
  const connect = useCallback(async (address) => {
    setConnecting(true)
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await response.json()

      if (data.success) {
        setConnected(true)
        setDeviceType(data.deviceType)
        setDeviceAddress(address)

        // Reload devices (backend persisted the device)
        await loadDevices()

        return { success: true, deviceType: data.deviceType }
      }

      return { success: false, error: data.error }
    } catch (error) {
      console.error('[DeviceContext] Connect error:', error)
      return { success: false, error: error.message }
    } finally {
      setConnecting(false)
    }
  }, [loadDevices])

  // Disconnect current device
  const disconnect = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/disconnect`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setConnected(false)
        setDeviceType(null)
        setDeviceAddress(null)
      }

      return data
    } catch (error) {
      console.error('[DeviceContext] Disconnect error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Remove a device from DB
  const removeDevice = useCallback(async (deviceId) => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${deviceId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        await loadDevices()
      }
      return data
    } catch (error) {
      console.error('[DeviceContext] Remove device error:', error)
      return { success: false, error: error.message }
    }
  }, [loadDevices])

  // Start race
  const startRace = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/start-race`, {
        method: 'POST',
      })
      return await response.json()
    } catch (error) {
      console.error('[DeviceContext] Start race error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Press ESC
  const pressEsc = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/esc`, {
        method: 'POST',
      })
      return await response.json()
    } catch (error) {
      console.error('[DeviceContext] ESC error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Press button
  const pressButton = useCallback(async (buttonId) => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/button/${buttonId}`, {
        method: 'POST',
      })
      return await response.json()
    } catch (error) {
      console.error('[DeviceContext] Button error:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Derived state
  const isInLightsSequence = cuStatus?.start >= 1 && cuStatus?.start <= 7
  const isRacing = cuStatus?.start === 0

  const value = {
    // State
    connected,
    deviceType,
    deviceAddress,
    devices,
    scanResults,
    cuStatus,
    lastTimer,
    socketConnected,

    // Derived state
    isInLightsSequence,
    isRacing,

    // Loading states
    scanning,
    connecting,

    // Actions
    scan,
    connect,
    disconnect,
    removeDevice,
    startRace,
    pressEsc,
    pressButton,
    loadStatus,
    loadDevices,
  }

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider')
  }
  return context
}

export default DeviceContext
