import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useServerSocket } from '../hooks/useServerSocket'
import * as requests from './device/deviceRequests'

export const SIMULATOR_ADDRESS = 'SIMULATOR'

const DEVICE_EVENTS = [
  'connect',
  'disconnect',
  'cu:connected',
  'cu:disconnected',
  'cu:status',
  'cu:timer',
  'cu:connection',
]

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [connected, setConnected] = useState(false)
  const [deviceType, setDeviceType] = useState(null)
  const [deviceAddress, setDeviceAddress] = useState(null)
  const [devices, setDevices] = useState([])
  // The last scan's devices: temporary, not kept
  const [scanResults, setScanResults] = useState([])
  const [cuStatus, setCuStatus] = useState(requests.IDLE_STATUS)
  const [lastTimer, setLastTimer] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)

  const forgetDevice = useCallback(() => {
    setConnected(false)
    setDeviceType(null)
    setDeviceAddress(null)
  }, [])

  const handlers = {
    connect: () => setSocketConnected(true),
    disconnect: () => setSocketConnected(false),
    'cu:connected': () => setConnected(true),
    'cu:disconnected': forgetDevice,
    'cu:status': (status) => {
      if (status.connected !== undefined) setConnected(status.connected)
      setCuStatus(status)
    },
    'cu:timer': setLastTimer,
    'cu:connection': (data) => {
      setConnected(data.status === 'connected')
      if (data.device) setDeviceAddress(data.device.id)
    },
  }
  useServerSocket(DEVICE_EVENTS, (event, data) => handlers[event](data))

  const loadStatus = useCallback(
    () =>
      requests
        .getStatus()
        .then((data) => {
          setConnected(data.connected || false)
          setDeviceType(data.deviceType || null)
          setDeviceAddress(data.deviceAddress || null)
          setCuStatus(data.lastStatus || requests.IDLE_STATUS)
        })
        .catch((error) => console.error('[DeviceContext] Error loading status:', error)),
    []
  )

  const loadDevices = useCallback(
    () =>
      requests
        .getDevices()
        .then((data) => {
          if (data.success) setDevices(data.data || [])
        })
        .catch((error) => console.error('[DeviceContext] Error loading devices:', error)),
    []
  )

  useEffect(() => {
    loadStatus()
    loadDevices()
  }, [loadStatus, loadDevices])

  const scan = useCallback(async (timeout = 10000) => {
    setScanning(true)
    try {
      const data = await requests.scanDevices(timeout)
      if (!data.success) return []
      setScanResults(data.devices || [])
      return data.devices
    } catch (error) {
      console.error('[DeviceContext] Scan error:', error)
      return []
    } finally {
      setScanning(false)
    }
  }, [])

  const connect = useCallback(
    async (address) => {
      setConnecting(true)
      try {
        const data = await requests.connectDevice(address)
        if (!data.success) return { success: false, error: data.error }
        setConnected(true)
        setDeviceType(data.deviceType)
        setDeviceAddress(address)
        // The server has kept the device
        await loadDevices()
        return { success: true, deviceType: data.deviceType }
      } catch (error) {
        console.error('[DeviceContext] Connect error:', error)
        return { success: false, error: error.message }
      } finally {
        setConnecting(false)
      }
    },
    [loadDevices]
  )

  const disconnect = useCallback(async () => {
    try {
      const data = await requests.disconnectDevice()
      if (data.success) forgetDevice()
      return data
    } catch (error) {
      console.error('[DeviceContext] Disconnect error:', error)
      return { success: false, error: error.message }
    }
  }, [forgetDevice])

  const removeDevice = useCallback(
    async (deviceId) => {
      try {
        const data = await requests.deleteDevice(deviceId)
        if (data.success) await loadDevices()
        return data
      } catch (error) {
        console.error('[DeviceContext] Remove device error:', error)
        return { success: false, error: error.message }
      }
    },
    [loadDevices]
  )

  // The server's answer to a Control Unit command, or the reason it could not be sent
  const command = useCallback(async (name) => {
    try {
      return await requests.cuCommand(name)
    } catch (error) {
      console.error(`[DeviceContext] ${name} error:`, error)
      return { success: false, error: error.message }
    }
  }, [])

  const startRace = useCallback(() => command('start-race'), [command])
  const pressEsc = useCallback(() => command('esc'), [command])
  const pressButton = useCallback((buttonId) => command(`button/${buttonId}`), [command])

  const value = {
    connected,
    deviceType,
    deviceAddress,
    devices,
    scanResults,
    cuStatus,
    lastTimer,
    socketConnected,

    // Lights 1 to 5, false start or go: the start sequence is on
    isInLightsSequence: cuStatus?.start >= 1 && cuStatus?.start <= 7,
    isRacing: cuStatus?.start === 0,

    scanning,
    connecting,

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

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider')
  }
  return context
}

export default DeviceContext
