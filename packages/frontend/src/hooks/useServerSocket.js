import { useEffect, useEffectEvent } from 'react'
import { io } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || ''

const OPTIONS = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
}

/** A socket to the server, reconnecting forever; each of `events` goes to `onEvent(event, data)` as it is now. */
export function useServerSocket(events, onEvent) {
  const handle = useEffectEvent(onEvent)
  useEffect(() => {
    const socket = io(WS_URL, OPTIONS)
    for (const event of events) socket.on(event, (data) => handle(event, data))
    return () => socket.disconnect()
  }, [events])
}
