import { useEffect, useEffectEvent, useState } from 'react'
import { getReferenceData } from '@/lib/sessionApi'

/** The tracks, drivers and cars of the free session page; with no track chosen yet, the first one is. */
export function useFreeSessionReferences(trackId, setTrackId) {
  const [tracks, setTracks] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])

  const onLoaded = useEffectEvent((data) => {
    if (data.tracks?.length > 0) {
      setTracks(data.tracks)
      if (!trackId) setTrackId(data.tracks[0].id)
    }
    if (data.drivers) setDrivers(data.drivers)
    if (data.cars) setCars(data.cars)
  })
  useEffect(() => {
    getReferenceData().then((data) => onLoaded(data))
  }, [])

  return { tracks, drivers, cars }
}
