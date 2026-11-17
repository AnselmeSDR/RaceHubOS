import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || '/api'

/** The `data` of `GET /api<path>` once it answers with success, `fallback` until then or on failure. */
export function useApiData(path, fallback = null) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!path) return
    let current = true
    fetch(`${API_URL}${path}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (current && body?.success) setData(body.data ?? null)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [path])
  return data ?? fallback
}
