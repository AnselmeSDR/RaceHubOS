import { useEffect, useState } from 'react'

const STALE_AFTER_MS = 2000
const CHECK_EVERY_MS = 500

/** Whether the server's last news is too old to trust the timing shown. */
export function useIsStale(lastServerTime) {
  const [isStale, setIsStale] = useState(false)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsStale(!!lastServerTime && Date.now() - new Date(lastServerTime).getTime() > STALE_AFTER_MS)
    }, CHECK_EVERY_MS)
    return () => clearInterval(interval)
  }, [lastServerTime])
  return isStale
}
