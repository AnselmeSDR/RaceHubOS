import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { waitForRestart } from './api'

const WS_URL = import.meta.env.VITE_WS_URL || ''

export const PROGRESS_EVENT = 'addons:progress'

/**
 * The running add-on action, from `addons:progress`: { action, addon, step, status, error }.
 * Once it completes, the server restarts with the new build: the page reloads when it is back.
 */
export function useAddonProgress({ onRestarted = () => window.location.reload() } = {}) {
  const [progress, setProgress] = useState(null)
  const onRestartedRef = useRef(onRestarted)

  useEffect(() => {
    onRestartedRef.current = onRestarted
  })

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket', 'polling'] })
    socket.on(PROGRESS_EVENT, setProgress)
    return () => socket.disconnect()
  }, [])

  const complete = progress?.status === 'complete'
  useEffect(() => {
    if (!complete) return
    let cancelled = false
    waitForRestart().then(() => !cancelled && onRestartedRef.current())
    return () => {
      cancelled = true
    }
  }, [complete])

  return { progress, setProgress }
}
