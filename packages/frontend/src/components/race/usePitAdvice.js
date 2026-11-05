import { useEffect, useState } from 'react'
import { normalizePitAdvice } from '../../lib/pitAdvice'
const url = `${import.meta.env.VITE_API_URL || ''}/api/preferences/pitAdvice:settings`
export function usePitAdvice() {
  const [config, setConfig] = useState(() => normalizePitAdvice(null))
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    const load = () =>
      fetch(url)
        .then((response) => response.json())
        .then((body) => {
          if (active && body.success) {
            setConfig(normalizePitAdvice(body.data))
            setReady(true)
          }
        })
        .catch(() => {})
    load()
    window.addEventListener('pit:settings', load)
    return () => {
      active = false
      window.removeEventListener('pit:settings', load)
    }
  }, [])
  return { config, ready }
}
export async function savePitAdvice(value) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: normalizePitAdvice(value) }),
  })
  if (!response.ok || !(await response.json()).success) throw new Error('Unable to save pit advice')
  window.dispatchEvent(new Event('pit:settings'))
}
