import { useEffect, useEffectEvent } from 'react'
import { io } from 'socket.io-client'

// The events the test page shows; any other one is logged as unknown
export const CU_TEST_EVENTS = [
  'connect',
  'disconnect',
  'connect_error',
  'lap:completed',
  'lap_completed',
  'race:status',
  'cu:connected',
  'cu:disconnected',
  'cu:status',
  'cu:timer',
  'cu:reconnect-failed',
  'session:started',
  'session:stopped',
  'phase:started',
  'positions:updated',
]

/** Each event goes to `handlers[event](data, socket)`; any other one to `handlers.onUnknown(event, data)`. */
export function useCuTestSocket(handlers) {
  const handle = useEffectEvent((event, data, socket) => handlers[event]?.(data, socket))
  const unknown = useEffectEvent((event, data) => handlers.onUnknown?.(event, data))

  useEffect(() => {
    const socket = io()
    for (const event of CU_TEST_EVENTS) socket.on(event, (data) => handle(event, data, socket))
    // Catch-all: socket.io has no wildcard listener
    const dispatch = socket.onevent
    socket.onevent = function (packet) {
      const [event, data] = packet.data
      if (!CU_TEST_EVENTS.includes(event)) unknown(event, data)
      dispatch.call(socket, packet)
    }
    return () => socket.disconnect()
  }, [])
}
