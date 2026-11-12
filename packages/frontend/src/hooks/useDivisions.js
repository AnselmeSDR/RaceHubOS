import { useEffect, useState } from 'react'
import { getData } from '@/lib/sessionApi'

/** The divisions of `scope` (driver or car) from the highest rank, empty until read. */
export function useDivisions(scope) {
  const [divisions, setDivisions] = useState([])
  useEffect(() => {
    let current = true
    getData(`/api/divisions?scope=${scope}&limit=1000`).then((data) => {
      if (current && data) setDivisions(data)
    })
    return () => {
      current = false
    }
  }, [scope])
  return divisions
}
