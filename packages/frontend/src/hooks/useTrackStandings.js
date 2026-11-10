import { useCallback, useEffect, useState } from 'react'
import { STANDARD_SESSION_TYPES, SessionType } from '@racehubos/shared'
import { getTrackStandings } from '@/lib/sessionApi'

const EMPTY = Object.fromEntries([...STANDARD_SESSION_TYPES, SessionType.BALANCING].map((type) => [type, []]))

/** The free-session standings of a track, read again whenever a session finishes. */
export function useTrackStandings(trackId) {
  const [standings, setStandings] = useState(EMPTY)

  const reload = useCallback(
    () =>
      trackId
        ? getTrackStandings(trackId).then((data) => {
            if (data) setStandings(data)
          })
        : Promise.resolve(),
    [trackId]
  )

  useEffect(() => {
    reload()
  }, [reload])

  // A session can finish by itself (time or laps reached)
  useEffect(() => {
    const onFinished = () => reload()
    window.addEventListener('session:finished', onFinished)
    return () => window.removeEventListener('session:finished', onFinished)
  }, [reload])

  return { standings: trackId ? standings : EMPTY, reload }
}
