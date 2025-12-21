import { useState, useEffect, useCallback, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Default transform function (stable reference)
const defaultTransform = (data) => data.data || data

/**
 * Generic fetch hook with caching, refetch, and error handling
 * @param {string} url - API endpoint (relative or absolute)
 * @param {object} options - Configuration options
 * @returns {object} { data, loading, error, refetch }
 */
export function useFetch(url, options = {}) {
  const {
    enabled = true,
    refetchInterval = null,
    onSuccess = null,
    onError = null,
    initialData = undefined,
    transform = defaultTransform
  } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(!initialData && enabled)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  // Store callbacks in refs to avoid dependency changes
  const transformRef = useRef(transform)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    transformRef.current = transform
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  })

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`
      const response = await fetch(fullUrl, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      const transformedData = transformRef.current(result)
      setData(transformedData)
      onSuccessRef.current?.(transformedData)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        onErrorRef.current?.(err)
      }
    } finally {
      setLoading(false)
    }
  }, [url, enabled])

  useEffect(() => {
    fetchData()

    if (refetchInterval && enabled) {
      const interval = setInterval(fetchData, refetchInterval)
      return () => clearInterval(interval)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData, refetchInterval, enabled])

  const refetch = useCallback(() => fetchData(), [fetchData])

  return { data, loading, error, refetch }
}

/**
 * Fetch multiple endpoints in parallel
 * @param {object} endpoints - { key: url } mapping
 * @returns {object} { data: { key: value }, loading, error, refetch }
 */
export function useFetchAll(endpoints, options = {}) {
  const { enabled = true } = options
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const entries = Object.entries(endpoints)
      const results = await Promise.all(
        entries.map(async ([key, url]) => {
          const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`
          const res = await fetch(fullUrl)
          const json = await res.json()
          return [key, json.data || json]
        })
      )
      setData(Object.fromEntries(results))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [endpoints, enabled])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { data, loading, error, refetch: fetchAll }
}

export default useFetch
