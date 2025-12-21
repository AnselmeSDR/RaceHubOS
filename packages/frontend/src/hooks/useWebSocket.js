import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

/**
 * WebSocket hook with automatic reconnection and event handling
 * @param {object} handlers - Event handlers { eventName: handler }
 * @param {object} options - Configuration options
 * @returns {object} { connected, error, emit, socket }
 */
export function useWebSocket(handlers = {}, options = {}) {
  const {
    url = WS_URL,
    enabled = true,
    reconnection = true,
    reconnectionAttempts = Infinity,
    reconnectionDelay = 1000
  } = options

  const socketRef = useRef(null)
  const handlersRef = useRef(handlers)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionAttempts,
      reconnectionDelay
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
      handlersRef.current.onConnect?.()
    })

    socket.on('disconnect', () => {
      setConnected(false)
      handlersRef.current.onDisconnect?.()
    })

    socket.on('connect_error', (err) => {
      setError(err.message)
      handlersRef.current.onError?.(err)
    })

    // Register all event handlers from ref
    const eventNames = Object.keys(handlersRef.current).filter(
      name => !['onConnect', 'onDisconnect', 'onError'].includes(name)
    )

    eventNames.forEach(event => {
      socket.on(event, (...args) => {
        handlersRef.current[event]?.(...args)
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [url, enabled, reconnection, reconnectionAttempts, reconnectionDelay])

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  return {
    connected,
    error,
    emit,
    socketRef
  }
}

export default useWebSocket
