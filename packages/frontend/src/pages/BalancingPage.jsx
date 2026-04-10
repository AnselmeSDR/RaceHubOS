import { useState, useEffect, useCallback } from 'react'
import { Plus, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import { useApp } from '../context/AppContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SessionSection from '../components/championship/SessionSection'
import BalancingChart from '../components/balancing/BalancingChart'
import BalancingStandings from '../components/balancing/BalancingStandings'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function BalancingPage() {
  const { startRace: triggerCuStart } = useDevice()
  const {
    session,
    entries,
    maxLapsCompleted,
    findOrCreateFreeSession,
    createSession,
    loadSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    resetSession,
    clearSession,
  } = useSession()

  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(false)
  const { showStandings, toggleStandings, balancingTrack: selectedTrackId, setBalancingTrack: setSelectedTrackId } = useApp()
  const [standings, setStandings] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [maxLapTime, setMaxLapTime] = useState(() => {
    const stored = localStorage.getItem('racehubos-balancing-maxlaptime')
    return stored ? parseInt(stored) : null
  })

  const handleMaxLapTimeChange = useCallback((value) => {
    setMaxLapTime(value)
    if (value) localStorage.setItem('racehubos-balancing-maxlaptime', value)
    else localStorage.removeItem('racehubos-balancing-maxlaptime')
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tracksRes, driversRes, carsRes] = await Promise.all([
          fetch(`${API_URL}/api/tracks`),
          fetch(`${API_URL}/api/drivers`),
          fetch(`${API_URL}/api/cars`),
        ])
        const [tracksData, driversData, carsData] = await Promise.all([
          tracksRes.json(), driversRes.json(), carsRes.json(),
        ])
        if (tracksData.success && tracksData.data?.length > 0) {
          setTracks(tracksData.data)
          if (!selectedTrackId) setSelectedTrackId(tracksData.data[0].id)
        }
        if (driversData.success) setDrivers(driversData.data || [])
        if (carsData.success) setCars(carsData.data || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedTrackId) handleLoadSession()
  }, [selectedTrackId])

  const fetchStandings = useCallback(async () => {
    if (!selectedTrackId) {
      setStandings([])
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/records/track/${selectedTrackId}?championshipId=null`)
      const data = await res.json()
      if (data.success) {
        setStandings(data.data.balancing || [])
      }
    } catch (error) {
      console.error('Error fetching standings:', error)
    }
  }, [selectedTrackId])

  useEffect(() => { fetchStandings() }, [selectedTrackId])

  useEffect(() => {
    const onFinished = () => fetchStandings()
    window.addEventListener('session:finished', onFinished)
    return () => window.removeEventListener('session:finished', onFinished)
  }, [fetchStandings])

  const handleLoadSession = useCallback(async () => {
    if (!selectedTrackId) return
    const previousDrivers = session?.drivers || []
    setLoading(true)
    try {
      const foundSession = await findOrCreateFreeSession({ trackId: selectedTrackId, type: 'balancing' })
      if (!foundSession) return

      if ((!foundSession.drivers || foundSession.drivers.length === 0) && previousDrivers.length > 0) {
        const driversConfig = previousDrivers.map(sd => ({
          controller: sd.controller, driverId: sd.driverId, carId: sd.carId,
        }))
        await fetch(`${API_URL}/api/sessions/${foundSession.id}/drivers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: driversConfig })
        })
      }
      await loadSession(foundSession.id)
    } catch (error) {
      console.error('Error loading session:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedTrackId, session?.drivers, findOrCreateFreeSession, loadSession])

  const handleNewSession = async () => {
    if (!selectedTrackId) return
    setLoading(true)
    try {
      const result = await createSession({
        trackId: selectedTrackId,
        type: 'balancing',
        name: 'Équilibrage',
        status: 'draft',
        maxDuration: session?.maxDuration || null,
        maxLaps: session?.maxLaps || null,
        gracePeriod: session?.gracePeriod || 30000,
      })
      if (result.success && result.data?.id && session?.drivers?.length > 0) {
        const driversConfig = session.drivers.map(sd => ({
          controller: sd.controller, driverId: sd.driverId, carId: sd.carId,
        }))
        await fetch(`${API_URL}/api/sessions/${result.data.id}/drivers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: driversConfig })
        })
        await loadSession(result.data.id)
      }
    } catch (error) {
      console.error('Error creating session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    if (!session?.id) return
    await startSession(session.id)
  }
  const handlePause = async () => { if (session?.id) await pauseSession(session.id) }
  const handleResume = async () => { if (session?.id) await resumeSession(session.id) }
  const handleStop = async () => {
    if (!session?.id) return
    await stopSession(session.id)
    await fetchStandings()
  }
  const handleSaveConfig = async (data) => {
    if (!session?.id) return
    try {
      if (data.name !== undefined || data.maxDuration !== undefined || data.maxLaps !== undefined || data.gracePeriod !== undefined) {
        await fetch(`${API_URL}/api/sessions/${session.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name, maxDuration: data.maxDuration, maxLaps: data.maxLaps, gracePeriod: data.gracePeriod })
        })
      }
      if (data.status !== undefined && data.status !== session.status) {
        await fetch(`${API_URL}/api/sessions/${session.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: data.status })
        })
      }
      if (data.drivers?.length > 0) {
        await fetch(`${API_URL}/api/sessions/${session.id}/drivers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: data.drivers })
        })
      }
      await loadSession(session.id)
    } catch (err) {
      console.error('Error saving session config:', err)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })
      clearSession()
      await handleLoadSession()
    } catch (err) {
      console.error('Error deleting session:', err)
    }
  }

  const handleResetSession = async (sessionId) => {
    const result = await resetSession(sessionId)
    if (result.success) await fetchStandings()
  }

  const isSessionActive = session && ['active', 'paused', 'finishing'].includes(session.status) && session.type === 'balancing'

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedTrackId || ''} onValueChange={setSelectedTrackId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sélectionner circuit..." />
            </SelectTrigger>
            <SelectContent>
              {tracks.map(track => (
                <SelectItem key={track.id} value={track.id}>{track.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm font-medium text-muted-foreground">Équilibrage</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSession}
            disabled={!selectedTrackId || isSessionActive || loading}
          >
            <Plus className="size-4" />
            Nouvelle session
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleStandings}
            title={showStandings ? 'Masquer le classement' : 'Afficher le classement'}
          >
            {showStandings ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`grid grid-cols-1 ${showStandings ? 'lg:grid-cols-3' : ''} gap-4`}>
          {/* Left: Session + Chart */}
          <div className={`${showStandings ? 'lg:col-span-2' : ''} space-y-4`}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
              </div>
            ) : (
              <>
                <SessionSection
                  session={session}
                  sessions={[]}
                  drivers={drivers}
                  cars={cars}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                  onTriggerCuStart={triggerCuStart}
                  onSaveConfig={handleSaveConfig}
                  onDelete={handleDeleteSession}
                  onReset={handleResetSession}
                  maxLapTime={maxLapTime}
                  onMaxLapTimeChange={handleMaxLapTimeChange}
                />

                {session && maxLapsCompleted > 0 && (
                  <BalancingChart entries={entries} maxLapTime={maxLapTime} />
                )}
              </>
            )}
          </div>

          {/* Right: Standings */}
          {showStandings && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Classement Général</h2>
              <BalancingStandings standings={standings} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
