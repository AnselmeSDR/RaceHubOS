import { useEffect, useEffectEvent } from 'react'

/** Calls `onEvent(event)`, as it is now, for each of `events` dispatched on the window. */
export function useWindowEvents(events, onEvent) {
  const handle = useEffectEvent(onEvent)
  useEffect(() => {
    const listener = (event) => handle(event)
    for (const name of events) window.addEventListener(name, listener)
    return () => {
      for (const name of events) window.removeEventListener(name, listener)
    }
  }, [events])
}
