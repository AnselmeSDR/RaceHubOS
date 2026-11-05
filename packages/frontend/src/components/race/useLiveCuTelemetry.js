import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useDevice } from '../../context/DeviceContext'

/** Freshness clock belongs to this mounted feature, never DeviceContext. */
export function useLiveCuTelemetry(enabled = true) {
  const device = useDevice()
  const [status, setStatus] = useState(null)
  const [receivedAt, setReceivedAt] = useState(null)
  const [now, setNow] = useState(Date.now)
  const [socketConnected, setSocketConnected] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const socket = io(import.meta.env.VITE_WS_URL || '')
    socket.on('connect', () => setSocketConnected(true))
    socket.on('disconnect', () => {
      setSocketConnected(false)
      setReceivedAt(null)
    })
    socket.on('cu:disconnected', () => setReceivedAt(null))
    socket.on('cu:status', (value) => {
      setStatus(value)
      setReceivedAt(Date.now())
      setNow(Date.now())
    })
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(timer)
      socket.disconnect()
    }
  }, [enabled])
  const fresh =
    enabled &&
    device.connected &&
    socketConnected &&
    receivedAt !== null &&
    now >= receivedAt &&
    now - receivedAt <= 5000
  return {
    ...device,
    cuStatus: status,
    lastStatusAt: receivedAt,
    now,
    socketConnected,
    connectionState: fresh ? 'live' : device.connected ? 'stale' : 'disconnected',
  }
}
