import { useState, useEffect, useCallback } from 'react'
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import SessionSection from '../components/championship/SessionSection'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import TrackRecordsPanel from '../components/race/freePractice/TrackRecordsPanel'

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
  const [trackRecords, setTrackRecords] = useState({})
  const [practiceSortBy, setPracticeSortBy] = useState('laps')

  // Fetch tracks on mount
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const res = await fetch(`${API_URL}/api/tracks`)
        const data = await res.json()
        if (data.success && data.data?.length > 0) {
          setTracks(data.data)
          // Auto-select first track
          if (!selectedTrackId) {
            setSelectedTrackId(data.data[0].id)
          }
        }
      } catch (error) {
        console.error('Error fetching tracks:', error)
      }
    }
    fetchTracks()
  }, [])

  // Load session when track or type changes
  useEffect(() => {
    if (selectedTrackId && selectedType) {
      handleLoadSession()
    }
  }, [selectedTrackId, selectedType])

  // Fetch track records
  const fetchTrackRecords = useCallback(async () => {
    if (!selectedTrackId) {
      setTrackRecords({})
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/records/track/${selectedTrackId}?championshipId=null`)
      const data = await res.json()
      if (data.success) {
        setTrackRecords(data.data)
      }
    } catch (error) {
      console.error('Error fetching track records:', error)
    }
  }, [selectedTrackId])

  // Fetch track records when track changes (free sessions only)
  useEffect(() => {
    fetchTrackRecords()
  }, [fetchTrackRecords])

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

  // Handle new session (force create)
  const handleNewSession = async () => {
    if (!selectedTrackId || !selectedType) return

    setLoading(true)
    try {
      await createSession({
        trackId: selectedTrackId,
        type: selectedType,
        name: `${SESSION_TYPES.find(t => t.value === selectedType)?.label || selectedType} libre`,
      })
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
    // Refresh records after session ends
    await fetchTrackRecords()
  }

  const handleConfig = () => {
    // TODO: Open session config modal if needed
  }

  const selectedTrack = tracks.find(t => t.id === selectedTrackId)
  const isSessionActive = session && ['ready', 'active', 'paused', 'finishing'].includes(session.status)

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: Track & Type selection */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Track selector */}
          <div className="relative">
            <select
              value={selectedTrackId || ''}
              onChange={(e) => handleTrackChange(e.target.value)}
              disabled={isSessionActive}
              className="appearance-none bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700 disabled:opacity-50"
            >
              <option value="">Sélectionner circuit...</option>
              {tracks.map(track => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Type selector (pills) */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {SESSION_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => handleTypeChange(type.value)}
                disabled={isSessionActive}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                  selectedType === type.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Nouvelle session
          </button>

          {/* Track info */}
          {selectedTrack && (
            <div className="text-sm text-gray-500">
              {selectedTrack.length && `${selectedTrack.length}m`}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Session + Leaderboard */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
          ) : (
            <>
              {/* Session Section */}
              <SessionSection
                session={session}
                sessions={[]}
                drivers={[]}
                cars={[]}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onTriggerCuStart={triggerCuStart}
                onConfig={handleConfig}
              />

              {/* Leaderboard */}
              {session && (
                <SessionLeaderboard
                  entries={entries}
                  sortBy={session.type === 'practice' ? practiceSortBy :
                    session.type === 'qualif' ? 'bestLap' : 'race'}
                  onSortChange={session.type === 'practice' ? setPracticeSortBy : undefined}
                  sessionType={session.type}
                />
              )}
            </>
          )}
        </div>

        {/* Right: Track records panel */}
        <TrackRecordsPanel
          selectedTrack={selectedTrack}
          trackRecords={trackRecords}
        />
      </div>
    </div>
  )
}
