import { useEffect, useState } from 'react'
import { useWindowEvents } from '@/hooks/useWindowEvents'
import { getBracket } from '@/lib/championshipApi'

const REFRESH_EVENTS = ['session:finished', 'championship:races_assigned', 'session:status_changed']

/**
 * The championship's bracket, read again when a session finishes or changes, or races are assigned;
 * the last one read is kept when a reading fails.
 */
export function useBracket(championshipId) {
  const [bracket, setBracket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [readings, setReadings] = useState(0)

  useWindowEvents(REFRESH_EVENTS, () => setReadings((n) => n + 1))

  useEffect(() => {
    let current = true
    getBracket(championshipId).then((data) => {
      if (!current) return
      if (data) setBracket(data)
      setLoading(false)
    })
    return () => {
      current = false
    }
  }, [championshipId, readings])

  return { bracket, loading }
}
