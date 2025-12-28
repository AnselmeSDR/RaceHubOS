import { useState, useEffect, useCallback } from 'react'
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import SessionSection from '../components/championship/SessionSection'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import StartingGrid from '../components/race/StartingGrid'
import StandingsTabs from '../components/championship/StandingsTabs'
import SessionConfigModal from '../components/championship/SessionConfigModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const SESSION_TYPES = [
  { value: 'practice', label: 'Essais libres' },
  { value: 'qualif', label: 'Qualifications' },
  { value: 'race', label: 'Course' },
]

export default function FreeSessionPage() {
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

  // Data
  const [tracks, setTracks] = useState([])
  const [selectedTrackId, setSelectedTrackId] = useState(null)
  const [selectedType, setSelectedType] = useState('practice')
  const [loading, setLoading] = useState(false)
  const [standings, setStandings] = useState({ practice: [], qualif: [], race: [] })
  const [practiceSortBy, setPracticeSortBy] = useState('laps')
  const [configSession, setConfigSession] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])

  // Fetch tracks, drivers, cars on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tracksRes, driversRes, carsRes] = await Promise.all([
          fetch(`${API_URL}/api/tracks`),
          fetch(`${API_URL}/api/drivers`),
          fetch(`${API_URL}/api/cars`),
        ])
        const [tracksData, driversData, carsData] = await Promise.all([
          tracksRes.json(),
          driversRes.json(),
          carsRes.json(),
        ])
        if (tracksData.success && tracksData.data?.length > 0) {
          setTracks(tracksData.data)
          if (!selectedTrackId) {
            setSelectedTrackId(tracksData.data[0].id)
          }
        }
        if (driversData.success) setDrivers(driversData.data || [])
        if (carsData.success) setCars(carsData.data || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  // Load session when track or type changes
  useEffect(() => {
    if (selectedTrackId && selectedType) {
      handleLoadSession()
    }
  }, [selectedTrackId, selectedType])

  // Fetch standings (records for free sessions)
  const fetchStandings = useCallback(async () => {
    if (!selectedTrackId) {
      setStandings({ practice: [], qualif: [], race: [] })
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/records/track/${selectedTrackId}?championshipId=null`)
      const data = await res.json()
      if (data.success) {
        // Transform records to standings format
        setStandings({
          practice: (data.data.practice || []).map(lap => ({
            ...lap,
            lapTime: lap.lapTime,
            bestTime: lap.lapTime,
          })),
          qualif: (data.data.qualif || []).map(lap => ({
            ...lap,
            bestTime: lap.lapTime,
          })),
          race: (data.data.race || []).map(lap => ({
            ...lap,
            bestTime: lap.lapTime,
            totalTime: lap.lapTime,
          })),
        })
      }
    } catch (error) {
      console.error('Error fetching standings:', error)
    }
  }, [selectedTrackId])

  // Fetch standings when track changes
  useEffect(() => {
    fetchStandings()
  }, [fetchStandings])

  const handleLoadSession = useCallback(async () => {
    if (!selectedTrackId || !selectedType) return

    setLoading(true)
    try {
      const foundSession = await findOrCreateFreeSession({
        trackId: selectedTrackId,
        type: selectedType,
      })

      // If session exists and is active, load it into SyncService
      if (foundSession && ['ready', 'active', 'paused'].includes(foundSession.status)) {
        await loadSession(foundSession.id)
      }
    } catch (error) {
      console.error('Error loading session:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedTrackId, selectedType, findOrCreateFreeSession, loadSession])

  // Handle track change
  const handleTrackChange = (trackId) => {
    setSelectedTrackId(trackId)
  }

  // Handle type change
  const handleTypeChange = (type) => {
    setSelectedType(type)
  }

  // Handle new session (force create, copy config from last session)
  const handleNewSession = async () => {
    if (!selectedTrackId || !selectedType) return

    setLoading(true)
    try {
      // Create session with config from previous session
      const result = await createSession({
        trackId: selectedTrackId,
        type: selectedType,
        name: `${SESSION_TYPES.find(t => t.value === selectedType)?.label || selectedType} libre`,
        maxDuration: session?.maxDuration || null,
        maxLaps: session?.maxLaps || null,
        gracePeriod: session?.gracePeriod || 30000,
      })

      // Copy drivers from previous session
      if (result.success && result.data?.id && session?.drivers?.length > 0) {
        const driversConfig = session.drivers.map(sd => ({
          controller: sd.controller,
          driverId: sd.driverId,
          carId: sd.carId,
        }))
        await fetch(`${API_URL}/api/sessions/${result.data.id}/drivers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: driversConfig })
        })
        // Reload session to get updated drivers
        await loadSession(result.data.id)
      }
    } catch (error) {
      console.error('Error creating session:', error)
    } finally {
      setLoading(false)
    }
  }

  // Session handlers
  const handleStart = async () => {
    if (!session?.id) return
    await startSession(session.id)
  }

  const handlePause = async () => {
    if (!session?.id) return
    await pauseSession(session.id)
  }

  const handleResume = async () => {
    if (!session?.id) return
    await resumeSession(session.id)
  }

  const handleStop = async () => {
    if (!session?.id) return
    await stopSession(session.id)
    // Refresh standings after session ends
    await fetchStandings()
  }

  const handleConfig = () => {
    if (session) {
      setConfigSession(session)
    }
  }

  const handleSaveSessionConfig = async (data) => {
    if (!configSession) return
    try {
      await fetch(`${API_URL}/api/sessions/${configSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          maxDuration: data.maxDuration,
          maxLaps: data.maxLaps,
          gracePeriod: data.gracePeriod
        })
      })
      if (data.status !== configSession.status) {
        await fetch(`${API_URL}/api/sessions/${configSession.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: data.status })
        })
      }
      if (data.drivers?.length > 0) {
        await fetch(`${API_URL}/api/sessions/${configSession.id}/drivers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: data.drivers })
        })
      }
      await loadSession(configSession.id)
      setConfigSession(null)
    } catch (err) {
      console.error('Error saving session config:', err)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })
      setConfigSession(null)
      clearSession()
      await handleLoadSession()
    } catch (err) {
      console.error('Error deleting session:', err)
    }
  }

  const handleResetSession = async (sessionId) => {
    const result = await resetSession(sessionId)
    if (result.success) {
      await fetchStandings()
    }
  }

  const selectedTrack = tracks.find(t => t.id === selectedTrackId)
  // Only block changes if session is actively running (not finished)
  const isSessionActive = session &&
    ['active', 'paused', 'finishing'].includes(session.status) &&
    session.type === selectedType

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: Track & Type selection */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Track selector */}
          <div className="relative">
            <select
              value={selectedTrackId || ''}
              onChange={(e) => handleTrackChange(e.target.value)}
              disabled={isSessionActive}
              className="appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              <option value="">Sélectionner circuit...</option>
              {tracks.map(track => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Type selector (pills) */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {SESSION_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => handleTypeChange(type.value)}
                disabled={isSessionActive}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                  selectedType === type.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* New session button */}
          <button
            onClick={handleNewSession}
            disabled={!selectedTrackId || isSessionActive || loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Nouvelle session
          </button>

          {/* Track info */}
          {selectedTrack && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedTrack.length && `${selectedTrack.length}m`}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Session + Leaderboard */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Session en cours
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : (
              <>
                {/* Session Section */}
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
                  onConfig={handleConfig}
                />

                {/* Leaderboard or Grid */}
                {session && (
                  maxLapsCompleted === 0 && session.status !== 'finished' ? (
                    <StartingGrid entries={entries} />
                  ) : (
                    <SessionLeaderboard
                      entries={entries}
                      sortBy={session.type === 'practice' ? practiceSortBy :
                        session.type === 'qualif' ? 'bestLap' : 'race'}
                      onSortChange={session.type === 'practice' ? setPracticeSortBy : undefined}
                      sessionType={session.type}
                    />
                  )
                )}
              </>
            )}
          </div>

          {/* Right column: Standings */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Classement Général
            </h2>
            <StandingsTabs
              standings={standings}
              drivers={drivers}
              activeTab={selectedType}
              onTabChange={setSelectedType}
            />
          </div>
        </div>
      </div>

      {/* Session Config Modal */}
      {configSession && (
        <SessionConfigModal
          session={configSession}
          sessions={[]}
          drivers={drivers}
          cars={cars}
          sessionDrivers={configSession.drivers || []}
          open={!!configSession}
          onClose={() => setConfigSession(null)}
          onSave={handleSaveSessionConfig}
          onDelete={handleDeleteSession}
          onReset={handleResetSession}
        />
      )}
    </div>
  )
}
