import { useState, useEffect, useCallback } from 'react'
import { Plus, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SessionSection from '../components/championship/SessionSection'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import StartingGrid from '../components/race/StartingGrid'
import StandingsTabs from '../components/championship/StandingsTabs'
import SessionConfigModal from '../components/championship/SessionConfigModal'

const API_URL = import.meta.env.VITE_API_URL || ''

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

  const [tracks, setTracks] = useState([])
  const [selectedTrackId, setSelectedTrackId] = useState(null)
  const [selectedType, setSelectedType] = useState('practice')
  const [loading, setLoading] = useState(false)
  const [standings, setStandings] = useState({ practice: [], qualif: [], race: [] })
  const [practiceSortBy, setPracticeSortBy] = useState('laps')
  const [configSession, setConfigSession] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [showStandings, setShowStandings] = useState(true)

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
    if (selectedTrackId && selectedType) handleLoadSession()
  }, [selectedTrackId, selectedType])

  const fetchStandings = useCallback(async () => {
    if (!selectedTrackId) {
      setStandings({ practice: [], qualif: [], race: [] })
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/records/track/${selectedTrackId}?championshipId=null`)
      const data = await res.json()
      if (data.success) {
        setStandings({
          practice: (data.data.practice || []).map(lap => ({ ...lap, bestTime: lap.lapTime })),
          qualif: (data.data.qualif || []).map(lap => ({ ...lap, bestTime: lap.lapTime })),
          race: (data.data.race || []).map(lap => ({ ...lap, bestTime: lap.lapTime, totalTime: lap.lapTime })),
        })
      }
    } catch (error) {
      console.error('Error fetching standings:', error)
    }
  }, [selectedTrackId])

  useEffect(() => { fetchStandings() }, [fetchStandings])

  const handleLoadSession = useCallback(async () => {
    if (!selectedTrackId || !selectedType) return
    setLoading(true)
    try {
      const foundSession = await findOrCreateFreeSession({ trackId: selectedTrackId, type: selectedType })
      if (foundSession) await loadSession(foundSession.id)
    } catch (error) {
      console.error('Error loading session:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedTrackId, selectedType, findOrCreateFreeSession, loadSession])

  const handleNewSession = async () => {
    if (!selectedTrackId || !selectedType) return
    setLoading(true)
    try {
      const result = await createSession({
        trackId: selectedTrackId,
        type: selectedType,
        name: `${SESSION_TYPES.find(t => t.value === selectedType)?.label || selectedType} libre`,
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

  const handleStart = async () => { if (session?.id) await startSession(session.id) }
  const handlePause = async () => { if (session?.id) await pauseSession(session.id) }
  const handleResume = async () => { if (session?.id) await resumeSession(session.id) }
  const handleStop = async () => {
    if (!session?.id) return
    await stopSession(session.id)
    await fetchStandings()
  }
  const handleConfig = () => { if (session) setConfigSession(session) }

  const handleSaveSessionConfig = async (data) => {
    if (!configSession) return
    try {
      await fetch(`${API_URL}/api/sessions/${configSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, maxDuration: data.maxDuration, maxLaps: data.maxLaps, gracePeriod: data.gracePeriod })
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
    if (result.success) await fetchStandings()
  }

  const selectedTrack = tracks.find(t => t.id === selectedTrackId)
  const isSessionActive = session && ['active', 'paused', 'finishing'].includes(session.status) && session.type === selectedType

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

          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList>
              {SESSION_TYPES.map(type => (
                <TabsTrigger key={type.value} value={type.value}>
                  {type.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
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
            onClick={() => setShowStandings(s => !s)}
            title={showStandings ? 'Masquer le classement' : 'Afficher le classement'}
          >
            {showStandings ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`grid grid-cols-1 ${showStandings ? 'lg:grid-cols-3' : ''} gap-4`}>
          {/* Left: Session + Leaderboard */}
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
                  onConfig={handleConfig}
                />

                {session && (
                  maxLapsCompleted === 0 && session.status !== 'finished' ? (
                    <StartingGrid entries={entries} />
                  ) : (
                    <SessionLeaderboard
                      entries={entries}
                      sortBy={session.type === 'practice' ? practiceSortBy : session.type === 'qualif' ? 'bestLap' : 'race'}
                      onSortChange={session.type === 'practice' ? setPracticeSortBy : undefined}
                      sessionType={session.type}
                    />
                  )
                )}
              </>
            )}
          </div>

          {/* Right: Standings */}
          {showStandings && <div>
            <h2 className="text-sm font-semibold mb-3">Classement Général</h2>
            <StandingsTabs
              standings={standings}
              drivers={drivers}
              activeTab={selectedType}
              onTabChange={setSelectedType}
            />
          </div>}
        </div>
      </div>

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
