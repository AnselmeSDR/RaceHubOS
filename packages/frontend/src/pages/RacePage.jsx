import { useState, useEffect, useCallback } from 'react'
import {
  SignalIcon,
  SignalSlashIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ClockIcon,
  FlagIcon,
  TrophyIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { useRace } from '../context/RaceContext'
import { useRaceState } from '../hooks/useRaceState'
import { useControllerConfig } from '../hooks/useControllerConfig'
import ConfigPanel from '../components/config/ConfigPanel'
import ConfigStatus from '../components/config/ConfigStatus'
import StateChip from '../components/race/StateChip'
import LapTime from '../components/race/LapTime'
import Leaderboard from '../components/race/Leaderboard'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function RacePage() {
  const {
    cuConnected,
    startQualifying,
    startRace,
    start,
    pause,
    resume,
    finish,
    stop,
    dismiss,
    setCurrentTrackId,
    setControllerConfigs,
    freePracticeBoard,
    resetFreePracticeBoard
  } = useRace()
  const {
    state,
    session,
    leaderboard,
    isIdle,
    isPending,
    isRunning,
    isPaused,
    isResults,
    canStart,
    canPause,
    canResume,
    canFinish,
    canStop,
    canDismiss,
    elapsedFormatted,
    remainingFormatted,
    progress,
    sessionName,
    sessionType,
    isQualifying,
    isRace,
    remaining
  } = useRaceState()

  // Data fetching
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])
  const [championships, setChampionships] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)

  // Track records (local UI state)
  const [trackRecords, setTrackRecords] = useState({ free: [], qualifying: [], race: [] })

  // Controller config
  const {
    configs,
    loading: configLoading,
    fetchConfigs,
    updateSlot,
    isComplete,
    configuredCount,
    unconfiguredSlots
  } = useControllerConfig()

  // UI state
  const [configExpanded, setConfigExpanded] = useState(false)
  const [showQualifyingModal, setShowQualifyingModal] = useState(false)
  const [showRaceModal, setShowRaceModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Form states
  const [qualifyingForm, setQualifyingForm] = useState({
    name: '',
    duration: 10,
    maxLaps: 0,
    championshipId: null
  })
  const [raceForm, setRaceForm] = useState({
    name: '',
    duration: 0,
    maxLaps: 20,
    championshipId: null,
    useQualifyingGrid: false
  })

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [driversRes, carsRes, tracksRes, champsRes] = await Promise.all([
          fetch(`${API_URL}/api/drivers`),
          fetch(`${API_URL}/api/cars`),
          fetch(`${API_URL}/api/tracks`),
          fetch(`${API_URL}/api/championships`)
        ])

        const [driversData, carsData, tracksData, champsData] = await Promise.all([
          driversRes.json(),
          carsRes.json(),
          tracksRes.json(),
          champsRes.json()
        ])

        setDrivers(driversData.data || [])
        setCars(carsData.data || [])
        setTracks(tracksData.data || [])
        setChampionships(champsData.data || [])

        if (tracksData.data?.length > 0 && !selectedTrack) {
          setSelectedTrack(tracksData.data[0])
        }
      } catch {
        // Failed to fetch data
      }
    }

    fetchData()
  }, [])

  // Fetch track records when track changes and sync with context
  useEffect(() => {
    if (selectedTrack?.id) {
      fetchTrackRecords(selectedTrack.id)
      fetchConfigs(selectedTrack.id)
      setCurrentTrackId(selectedTrack.id)
    }
  }, [selectedTrack?.id, fetchConfigs, setCurrentTrackId])

  // Sync controller configs with context
  useEffect(() => {
    setControllerConfigs(configs)
  }, [configs, setControllerConfigs])

  const fetchTrackRecords = async (trackId) => {
    try {
      const response = await fetch(`${API_URL}/api/records/track/${trackId}`)
      if (!response.ok) {
        setTrackRecords({ free: [], qualifying: [], race: [] })
        return
      }
      const data = await response.json()
      setTrackRecords({
        free: data.data?.free || [],
        qualifying: data.data?.qualifying || [],
        race: data.data?.race || []
      })
    } catch {
      setTrackRecords({ free: [], qualifying: [], race: [] })
    }
  }

  // Refresh records periodically when in free practice mode (to catch new records)
  useEffect(() => {
    if (!isIdle || !selectedTrack?.id) return

    const interval = setInterval(() => {
      fetchTrackRecords(selectedTrack.id)
    }, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [isIdle, selectedTrack?.id])

  // Show results modal when entering RESULTS state
  useEffect(() => {
    if (isResults) {
      setShowResultsModal(true)
    }
  }, [isResults])

  // Handlers
  const handleConfigChange = useCallback((controller, data) => {
    updateSlot(controller, data.driverId, data.carId)
  }, [updateSlot])

  const handleStartQualifying = async () => {
    const params = {
      name: qualifyingForm.name || 'Qualifying',
      trackId: selectedTrack?.id,
      duration: qualifyingForm.duration > 0 ? qualifyingForm.duration : null,
      maxLaps: qualifyingForm.maxLaps > 0 ? qualifyingForm.maxLaps : null,
      championshipId: qualifyingForm.championshipId || null
    }

    await startQualifying(params)
    setShowQualifyingModal(false)
  }

  const handleStartRace = async () => {
    const params = {
      name: raceForm.name || 'Race',
      trackId: selectedTrack?.id,
      duration: raceForm.duration > 0 ? raceForm.duration : null,
      maxLaps: raceForm.maxLaps > 0 ? raceForm.maxLaps : null,
      championshipId: raceForm.championshipId || null,
      gridFromQualifying: raceForm.useQualifyingGrid
    }

    await startRace(params)
    setShowRaceModal(false)
  }

  const handleCancel = async () => {
    await stop()
    setShowCancelConfirm(false)
  }

  const handleDismiss = async () => {
    setShowResultsModal(false)
    await dismiss()
  }

  const canStartSession = selectedTrack && cuConnected && configuredCount > 0

  const sessionTypeLabel = isQualifying ? 'Qualifications' : isRace ? 'Course' : 'Session'
  const podiumEntries = leaderboard.slice(0, 3)

  // ===== RENDER: SESSION ACTIVE (PENDING/RUNNING/PAUSED/RESULTS) =====
  if (!isIdle) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header */}
        <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Session info */}
            <div>
              <h1 className="text-xl font-bold text-white">
                {sessionName || sessionTypeLabel}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-400 uppercase tracking-wide">
                  {sessionTypeLabel}
                </span>
                <StateChip state={state} />
              </div>
            </div>

            {/* Center: Timer */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase">Temps</div>
                <div className="text-3xl font-mono font-bold text-white tabular-nums">
                  {elapsedFormatted}
                </div>
              </div>
              {remaining !== null && (
                <>
                  <div className="w-px h-10 bg-gray-700" />
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase">Restant</div>
                    <div className={`text-3xl font-mono font-bold tabular-nums ${
                      remaining < 60000 ? 'text-red-500 animate-pulse' : 'text-white'
                    }`}>
                      {remainingFormatted}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: CU status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              cuConnected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
              {cuConnected ? <SignalIcon className="w-5 h-5" /> : <SignalSlashIcon className="w-5 h-5" />}
              <span className="text-sm font-medium">{cuConnected ? 'CU OK' : 'CU Off'}</span>
            </div>
          </div>

          {/* Progress bar */}
          {remaining !== null && progress > 0 && (
            <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 rounded-full ${
                  progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </header>

        {/* Main: Leaderboard */}
        <main className="flex-1 overflow-auto p-6">
          <Leaderboard leaderboard={leaderboard} sessionType={sessionType} />
        </main>

        {/* Bottom: Controls */}
        <div className="bg-black/80 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
          <div className="flex justify-center gap-4">
            {isPending && (
              <>
                <button
                  onClick={start}
                  disabled={!canStart}
                  className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  <PlayIcon className="w-6 h-6" />
                  Démarrer
                </button>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                >
                  <XMarkIcon className="w-6 h-6" />
                  Annuler
                </button>
              </>
            )}

            {isRunning && (
              <>
                <button
                  onClick={pause}
                  disabled={!canPause}
                  className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold rounded-xl"
                >
                  <PauseIcon className="w-6 h-6" />
                  Pause
                </button>
                <button
                  onClick={finish}
                  disabled={!canFinish}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  <FlagIcon className="w-6 h-6" />
                  Terminer
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={resume}
                  disabled={!canResume}
                  className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl"
                >
                  <PlayIcon className="w-6 h-6" />
                  Reprendre
                </button>
                <button
                  onClick={finish}
                  disabled={!canFinish}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  <FlagIcon className="w-6 h-6" />
                  Terminer
                </button>
              </>
            )}

            {isResults && !showResultsModal && (
              <button
                onClick={() => setShowResultsModal(true)}
                className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
              >
                <TrophyIcon className="w-6 h-6" />
                Voir Résultats
              </button>
            )}
          </div>
        </div>

        {/* Cancel confirmation modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">Annuler la session ?</h2>
              <p className="text-gray-300 mb-6">Cette action va annuler la session en cours.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
                >
                  Retour
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl"
                >
                  Annuler la session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results modal */}
        {showResultsModal && isResults && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full border border-gray-700 my-8">
              <div className="p-6 border-b border-gray-700 text-center">
                <TrophyIcon className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                <h2 className="text-2xl font-bold text-white">Résultats</h2>
                <p className="text-gray-400">{sessionName || sessionTypeLabel}</p>
              </div>

              {/* Podium */}
              {podiumEntries.length > 0 && (
                <div className="p-6 border-b border-gray-700">
                  <div className="flex items-end justify-center gap-4">
                    {/* 2nd */}
                    {podiumEntries[1] && (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
                          {podiumEntries[1].driver?.name?.charAt(0) || '2'}
                        </div>
                        <div className="bg-gray-400 text-gray-900 w-20 h-16 rounded-t-lg flex items-center justify-center text-2xl font-bold">2</div>
                        <p className="text-white text-sm mt-2 truncate max-w-[80px]">{podiumEntries[1].driver?.name}</p>
                      </div>
                    )}
                    {/* 1st */}
                    {podiumEntries[0] && (
                      <div className="text-center -mt-4">
                        <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold text-2xl mx-auto mb-2">
                          {podiumEntries[0].driver?.name?.charAt(0) || '1'}
                        </div>
                        <div className="bg-yellow-400 text-yellow-900 w-24 h-20 rounded-t-lg flex items-center justify-center text-3xl font-bold">1</div>
                        <p className="text-white font-bold mt-2 truncate max-w-[100px]">{podiumEntries[0].driver?.name}</p>
                      </div>
                    )}
                    {/* 3rd */}
                    {podiumEntries[2] && (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
                          {podiumEntries[2].driver?.name?.charAt(0) || '3'}
                        </div>
                        <div className="bg-orange-400 text-orange-900 w-20 h-12 rounded-t-lg flex items-center justify-center text-2xl font-bold">3</div>
                        <p className="text-white text-sm mt-2 truncate max-w-[80px]">{podiumEntries[2].driver?.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Full results */}
              <div className="p-6 max-h-60 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase">
                      <th className="text-left py-2">Pos</th>
                      <th className="text-left py-2">Pilote</th>
                      <th className="text-center py-2">Tours</th>
                      <th className="text-right py-2">Meilleur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {leaderboard.map((entry, idx) => (
                      <tr key={idx} className="text-white">
                        <td className="py-2 font-bold">{entry.position || idx + 1}</td>
                        <td className="py-2">{entry.driver?.name || 'Unknown'}</td>
                        <td className="py-2 text-center">{entry.laps ?? entry.lapCount ?? 0}</td>
                        <td className="py-2 text-right">
                          <LapTime time={entry.bestLap} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-gray-700">
                <button
                  onClick={handleDismiss}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  Retour au mode libre
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== RENDER: FREE PRACTICE (IDLE) =====
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Mode Libre</h1>
            <StateChip state={state} />
          </div>

          <div className="flex items-center gap-4">
            {/* Track selector */}
            <div className="relative">
              <select
                value={selectedTrack?.id || ''}
                onChange={(e) => {
                  const track = tracks.find(t => t.id === e.target.value)
                  setSelectedTrack(track)
                }}
                className="appearance-none bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700"
              >
                <option value="">Sélectionner circuit...</option>
                {tracks.map(track => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* CU status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              cuConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {cuConnected ? <SignalIcon className="w-5 h-5" /> : <SignalSlashIcon className="w-5 h-5" />}
              <span className="font-medium text-sm">{cuConnected ? 'CU Connecté' : 'CU Déconnecté'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Config */}
      <div className="bg-white border-b">
        <button
          onClick={() => setConfigExpanded(!configExpanded)}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Configuration Controllers</span>
            <ConfigStatus
              isComplete={isComplete}
              unconfiguredCount={unconfiguredSlots.length}
              unconfiguredSlots={unconfiguredSlots}
            />
          </div>
          {configExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
        </button>

        {configExpanded && (
          <div className="px-6 pb-4 border-t bg-gray-50">
            <div className="pt-4">
              <ConfigPanel
                configs={configs.reduce((acc, c) => { acc[c.controller] = c; return acc }, {})}
                drivers={drivers}
                cars={cars}
                onConfigChange={handleConfigChange}
                disabled={configLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Free Practice Leaderboard */}
        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <FlagIcon className="w-5 h-5 text-green-500" />
                Classement
              </h2>
              <button
                onClick={resetFreePracticeBoard}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Réinitialiser
              </button>
            </div>

            {Object.keys(freePracticeBoard).length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400">
                <FlagIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>En attente des tours...</p>
                <p className="text-sm mt-1">Roulez sur le circuit</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Pos</th>
                    <th className="px-4 py-3 text-left">Pilote</th>
                    <th className="px-4 py-3 text-center">Tours</th>
                    <th className="px-4 py-3 text-right">Meilleur</th>
                    <th className="px-4 py-3 text-right">Dernier</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(freePracticeBoard)
                    .map(([ctrl, data]) => {
                      const config = configs.find(c => String(c.controller) === ctrl)
                      const driver = config?.driver
                      return { controller: ctrl, ...data, driver }
                    })
                    .sort((a, b) => {
                      if (b.laps !== a.laps) return b.laps - a.laps
                      if (!a.bestLap) return 1
                      if (!b.bestLap) return -1
                      return a.bestLap - b.bestLap
                    })
                    .map((entry, index) => (
                      <tr
                        key={entry.controller}
                        className={`${index === 0 ? 'bg-yellow-50' : ''} ${Date.now() - entry.lastUpdate < 3000 ? 'bg-green-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-bold text-lg">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">
                            {entry.driver?.name || `Controller ${entry.controller}`}
                          </div>
                          {entry.driver && (
                            <div className="text-xs text-gray-500">#{entry.driver.number}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-lg">{entry.laps}</td>
                        <td className="px-4 py-3 text-right">
                          <LapTime time={entry.bestLap} size="md" />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          <LapTime time={entry.lastLap} size="sm" />
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Track Records */}
        <div className="w-80 border-l bg-white overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrophyIcon className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-gray-800">Records</h2>
          </div>

          {!selectedTrack ? (
            <div className="text-center text-gray-400 py-8">
              <p>Sélectionnez un circuit</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Free Practice Records */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Libre</h3>
                {trackRecords.free.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun record</p>
                ) : (
                  <div className="space-y-2">
                    {trackRecords.free.map((record, idx) => (
                      <div key={record.id} className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 truncate">{idx + 1}. {record.driver?.name}</div>
                          <div className="text-xs text-gray-500 truncate">{record.car?.brand} {record.car?.model}</div>
                        </div>
                        <LapTime time={record.lapTime} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Qualifying Records */}
              <div>
                <h3 className="text-xs font-semibold text-blue-600 uppercase mb-2">Qualifications</h3>
                {trackRecords.qualifying.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun record</p>
                ) : (
                  <div className="space-y-2">
                    {trackRecords.qualifying.map((record, idx) => (
                      <div key={record.id} className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 truncate">{idx + 1}. {record.driver?.name}</div>
                          <div className="text-xs text-gray-500 truncate">{record.car?.brand} {record.car?.model}</div>
                        </div>
                        <LapTime time={record.lapTime} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Race Records */}
              <div>
                <h3 className="text-xs font-semibold text-green-600 uppercase mb-2">Course</h3>
                {trackRecords.race.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun record</p>
                ) : (
                  <div className="space-y-2">
                    {trackRecords.race.map((record, idx) => (
                      <div key={record.id} className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 truncate">{idx + 1}. {record.driver?.name}</div>
                          <div className="text-xs text-gray-500 truncate">{record.car?.brand} {record.car?.model}</div>
                        </div>
                        <LapTime time={record.lapTime} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t px-6 py-4">
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => setShowQualifyingModal(true)}
            disabled={!canStartSession}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClockIcon className="w-5 h-5" />
            Qualifications
          </button>

          <button
            onClick={() => setShowRaceModal(true)}
            disabled={!canStartSession}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FlagIcon className="w-5 h-5" />
            Course
          </button>
        </div>

        {!canStartSession && (
          <p className="text-center text-sm text-gray-500 mt-2">
            {!selectedTrack && 'Sélectionnez un circuit. '}
            {!cuConnected && 'Control Unit non connecté. '}
            {configuredCount === 0 && 'Configurez au moins un controller. '}
          </p>
        )}
      </div>

      {/* Qualifying Modal */}
      {showQualifyingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Qualifications</h2>
              <button onClick={() => setShowQualifyingModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom (optionnel)</label>
                <input
                  type="text"
                  value={qualifyingForm.name}
                  onChange={(e) => setQualifyingForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Qualifications"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={qualifyingForm.duration}
                    onChange={(e) => setQualifyingForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tours max</label>
                  <input
                    type="number"
                    min="0"
                    value={qualifyingForm.maxLaps}
                    onChange={(e) => setQualifyingForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Championnat</label>
                <select
                  value={qualifyingForm.championshipId || ''}
                  onChange={(e) => setQualifyingForm(f => ({ ...f, championshipId: e.target.value || null }))}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Aucun</option>
                  {championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowQualifyingModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
              <button onClick={handleStartQualifying} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                <PlayIcon className="w-5 h-5" />
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Race Modal */}
      {showRaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Course</h2>
              <button onClick={() => setShowRaceModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom (optionnel)</label>
                <input
                  type="text"
                  value={raceForm.name}
                  onChange={(e) => setRaceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Course"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={raceForm.duration}
                    onChange={(e) => setRaceForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tours max</label>
                  <input
                    type="number"
                    min="0"
                    value={raceForm.maxLaps}
                    onChange={(e) => setRaceForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Championnat</label>
                <select
                  value={raceForm.championshipId || ''}
                  onChange={(e) => setRaceForm(f => ({ ...f, championshipId: e.target.value || null }))}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Aucun</option>
                  {championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={raceForm.useQualifyingGrid}
                  onChange={(e) => setRaceForm(f => ({ ...f, useQualifyingGrid: e.target.checked }))}
                  className="w-4 h-4 text-green-600 rounded"
                />
                <span className="text-sm text-gray-700">Grille depuis dernières qualifs</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRaceModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
              <button onClick={handleStartRace} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
                <FlagIcon className="w-5 h-5" />
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
