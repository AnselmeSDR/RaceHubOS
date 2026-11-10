import { useEffect, useState } from 'react'

/** The current time, refreshed every `everyMs`, for what fades with time. */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(interval)
  }, [everyMs])
  return now
}
