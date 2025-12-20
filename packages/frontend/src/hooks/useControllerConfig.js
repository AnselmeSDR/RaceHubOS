import { useState, useCallback, useMemo, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Hook to manage controller slot configurations (mapping controllers 1-6 to drivers/cars)
 * @param {string} initialTrackId - Optional initial track ID
 * @returns {Object} Controller config state and methods
 */
export function useControllerConfig(initialTrackId = null) {
  const [configs, setConfigs] = useState(
    Array.from({ length: 6 }, (_, i) => ({
      controller: String(i + 1),
      driverId: null,
      carId: null,
      driver: null,
      car: null,
      isActive: true
    }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTrackId, setCurrentTrackId] = useState(initialTrackId)

  // Use ref to avoid stale closure issues
  const trackIdRef = useRef(initialTrackId)

  /**
   * Fetch configurations for a specific track
   * @param {string} trackId - Track ID to fetch configs for
   */
  const fetchConfigs = useCallback(async (trackId) => {
    if (!trackId) {
      setError('Track ID is required')
      return
    }

    // Update both state and ref
    setCurrentTrackId(trackId)
    trackIdRef.current = trackId

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/config?trackId=${encodeURIComponent(trackId)}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch configurations: ${response.statusText}`)
      }

      const data = await response.json()

      // Ensure we always have 6 slots, merging with defaults
      const apiConfigs = data.data || data || []
      const mergedConfigs = Array.from({ length: 6 }, (_, i) => {
        const controller = String(i + 1)
        const existing = apiConfigs.find?.(c => String(c.controller) === controller)
        return existing ? {
          controller,
          driverId: existing.driverId,
          carId: existing.carId,
          driver: existing.driver,
          car: existing.car,
          isActive: existing.isActive !== false
        } : {
          controller,
          driverId: null,
          carId: null,
          driver: null,
          car: null,
          isActive: true
        }
      })

      setConfigs(mergedConfigs)
      setCurrentTrackId(trackId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update a single controller slot
   * @param {number} controller - Controller number (1-6)
   * @param {string|null} driverId - Driver ID or null
   * @param {string|null} carId - Car ID or null
   */
  const updateSlot = useCallback(async (controller, driverId, carId) => {
    // Use ref to get current trackId (avoids stale closure)
    const trackId = trackIdRef.current
    if (!trackId) {
      setError('No track selected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/config/${controller}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, driverId, carId })
      })

      if (!response.ok) {
        throw new Error(`Failed to update slot: ${response.statusText}`)
      }

      const responseData = await response.json()
      const updatedConfig = responseData.data || responseData

      setConfigs(prev => prev.map(c =>
        String(c.controller) === String(controller)
          ? {
              ...c,
              driverId: updatedConfig.driverId ?? driverId,
              carId: updatedConfig.carId ?? carId,
              driver: updatedConfig.driver || null,
              car: updatedConfig.car || null
            }
          : c
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, []) // No dependencies - uses ref for trackId

  /**
   * Clear a single controller slot (set driver and car to null)
   * @param {number} controller - Controller number (1-6)
   */
  const clearSlot = useCallback(async (controller) => {
    const trackId = trackIdRef.current
    if (!trackId) {
      setError('No track selected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/config/${controller}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, driverId: null, carId: null })
      })

      if (!response.ok) {
        throw new Error(`Failed to clear slot: ${response.statusText}`)
      }

      setConfigs(prev => prev.map(c =>
        String(c.controller) === String(controller)
          ? { ...c, driverId: null, carId: null, driver: null, car: null }
          : c
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, []) // No dependencies - uses ref for trackId

  /**
   * Clear all configurations for a track
   * @param {string} trackId - Track ID to clear configs for
   */
  const clearAll = useCallback(async (trackId) => {
    if (!trackId) {
      setError('Track ID is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/config?trackId=${encodeURIComponent(trackId)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to clear all configurations: ${response.statusText}`)
      }

      // Reset to default empty configs
      setConfigs(Array.from({ length: 6 }, (_, i) => ({
        controller: String(i + 1),
        driverId: null,
        carId: null,
        driver: null,
        car: null,
        isActive: true
      })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update multiple configurations at once
   * @param {Array} newConfigs - Array of config objects to update
   */
  const updateBulk = useCallback(async (newConfigs) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/config/bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: newConfigs })
      })

      if (!response.ok) {
        throw new Error(`Failed to update configurations: ${response.statusText}`)
      }

      const updatedConfigs = await response.json()

      // Merge updated configs with current state
      setConfigs(prev => {
        const updated = [...prev]
        const responseConfigs = Array.isArray(updatedConfigs) ? updatedConfigs : updatedConfigs.configs || []

        responseConfigs.forEach(newConfig => {
          const index = updated.findIndex(c => c.controller === newConfig.controller)
          if (index !== -1) {
            updated[index] = { ...updated[index], ...newConfig }
          }
        })

        return updated
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Computed: check if all active slots have both driver AND car
  const isComplete = useMemo(() => {
    return configs
      .filter(c => c.isActive)
      .every(c => c.driverId !== null && c.carId !== null)
  }, [configs])

  // Computed: count of configured slots (have both driver and car)
  const configuredCount = useMemo(() => {
    return configs.filter(c => c.driverId !== null && c.carId !== null).length
  }, [configs])

  // Computed: array of controller numbers that are active but not fully configured
  const unconfiguredSlots = useMemo(() => {
    return configs
      .filter(c => c.isActive && (c.driverId === null || c.carId === null))
      .map(c => c.controller)
  }, [configs])

  return {
    configs,
    loading,
    error,
    fetchConfigs,
    updateSlot,
    clearSlot,
    clearAll,
    updateBulk,
    isComplete,
    configuredCount,
    unconfiguredSlots
  }
}

export default useControllerConfig
