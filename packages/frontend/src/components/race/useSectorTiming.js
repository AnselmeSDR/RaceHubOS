import { useEffect, useState } from 'react'
const url = `${import.meta.env.VITE_API_URL || ''}/api/sector-timing`
export function useSectorTiming() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    const load = () =>
      fetch(url)
        .then((response) => response.json())
        .then((body) => {
          if (active && body.success) setEnabled(body.data.enabled === true)
        })
        .catch(() => {})
    load()
    window.addEventListener('sector:settings', load)
    return () => {
      active = false
      window.removeEventListener('sector:settings', load)
    }
  }, [])
  return enabled
}
export async function saveSectorTiming(enabled) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!response.ok) throw new Error('Unable to change sector timing')
  window.dispatchEvent(new Event('sector:settings'))
}
