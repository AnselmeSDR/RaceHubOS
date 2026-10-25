import { useEffect, useState } from 'react'
import { trackExtrasDefaults, normalizeTrackExtras } from '../../lib/pitPlan.mjs'
const url = `${import.meta.env.VITE_API_URL || ''}/api/preferences/trackExtras`
const defaults = trackExtrasDefaults
export function useTrackExtras() {
  const [config, setConfig] = useState(defaults)
  useEffect(() => {
    let active = true
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (active && d.success) setConfig(normalizeTrackExtras(d.data))
      })
      .catch(() => {})
    const update = (e) => setConfig(normalizeTrackExtras(e.detail))
    window.addEventListener('race:extras-saved', update)
    return () => {
      active = false
      window.removeEventListener('race:extras-saved', update)
    }
  }, [])
  return config
}
