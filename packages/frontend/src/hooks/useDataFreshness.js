import { useState, useEffect, useMemo } from 'react'

/**
 * Hook to track data freshness based on last server timestamp
 * @param {string|number|Date} lastServerTime - Last serverTime received from WebSocket
 * @returns {object} { status, age, label }
 */
export function useDataFreshness(lastServerTime) {
  const [now, setNow] = useState(Date.now())

  // Update current time every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return useMemo(() => {
    if (!lastServerTime) {
      return { status: 'offline', age: null, label: 'Offline' }
    }

    const serverTimestamp = new Date(lastServerTime).getTime()
    const age = now - serverTimestamp

    if (age < 2000) {
      return { status: 'live', age, label: 'Live' }
    }
    if (age < 5000) {
      const seconds = Math.round(age / 1000)
      return { status: 'delayed', age, label: `${seconds}s ago` }
    }
    return { status: 'offline', age, label: 'Offline' }
  }, [lastServerTime, now])
}

export default useDataFreshness
