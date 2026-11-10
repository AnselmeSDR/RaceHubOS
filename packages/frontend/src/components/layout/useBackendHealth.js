import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''
const EVERY_MS = 5000
const UNKNOWN_VERSION = '0.1.0'

/** Whether the server answers its health check, polled every five seconds, and its version. */
export function useBackendHealth() {
  const [health, setHealth] = useState({ connected: true, version: UNKNOWN_VERSION })

  useEffect(() => {
    const check = () =>
      fetch(`${API_URL}/health`)
        .then((res) => res.json())
        .then((data) => setHealth({ connected: data.status === 'ok', version: data.version || UNKNOWN_VERSION }))
        .catch(() => setHealth((h) => ({ ...h, connected: false })))
    check()
    const interval = setInterval(check, EVERY_MS)
    return () => clearInterval(interval)
  }, [])

  return health
}
