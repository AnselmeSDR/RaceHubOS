import { useState, useEffect, useCallback } from 'react'
import { useRace } from '../context/RaceContext'
import { useRaceState } from '../hooks/useRaceState'
import { useControllerConfig } from '../hooks/useControllerConfig'

// Session components
import SessionHeader from '../components/race/session/SessionHeader'
import SessionControls from '../components/race/session/SessionControls'
import CancelConfirmModal from '../components/race/session/CancelConfirmModal'
import ResultsModal from '../components/race/session/ResultsModal'

// Free practice components
import FreePracticeHeader from '../components/race/freePractice/FreePracticeHeader'
import ControllerConfigSection from '../components/race/freePractice/ControllerConfigSection'
import FreePracticeLeaderboard from '../components/race/freePractice/FreePracticeLeaderboard'
import TrackRecordsPanel from '../components/race/freePractice/TrackRecordsPanel'

// Shared components
import Leaderboard from '../components/race/Leaderboard'

// Modals
import SessionModal from '../components/race/modals/SessionModal'

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
    const [selectedTrack, setSelectedTrack] = useState(null)
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
    const [sessionModalType, setSessionModalType] = useState(null) // 'qualifying' | 'race' | null
    const [showResultsModal, setShowResultsModal] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [driversRes, carsRes, tracksRes] = await Promise.all([
                    fetch(`${API_URL}/api/drivers`),
                    fetch(`${API_URL}/api/cars`),
                    fetch(`${API_URL}/api/tracks`)
                ])

                const [driversData, carsData, tracksData] = await Promise.all([
                    driversRes.json(),
                    carsRes.json(),
                    tracksRes.json()
                ])

                setDrivers(driversData.data || [])
                setCars(carsData.data || [])
                setTracks(tracksData.data || [])

                if (tracksData.data?.length > 0 && !selectedTrack) {
                    setSelectedTrack(tracksData.data[0])
                }
            } catch {
                // Failed to fetch data
            }
        }

        fetchData()
    }, [])

    const fetchTrackRecords = useCallback(async (trackId) => {
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
    }, [])

    // Fetch track records when track changes
    useEffect(() => {
        if (selectedTrack?.id) {
            fetchTrackRecords(selectedTrack.id)
            fetchConfigs(selectedTrack.id)
            setCurrentTrackId(selectedTrack.id)
        }
    }, [selectedTrack?.id, fetchConfigs, setCurrentTrackId, fetchTrackRecords])

    // Sync controller configs with context
    useEffect(() => {
        setControllerConfigs(configs)
    }, [configs, setControllerConfigs])

    // Refresh records periodically in free practice
    useEffect(() => {
        if (!isIdle || !selectedTrack?.id) return

        const interval = setInterval(() => {
            fetchTrackRecords(selectedTrack.id)
        }, 3000)

        return () => clearInterval(interval)
    }, [isIdle, selectedTrack?.id, fetchTrackRecords])

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

    const handleStartSession = async (formData) => {
        const isQualifyingSession = sessionModalType === 'qualifying'
        const params = {
            name: formData.name || (isQualifyingSession ? 'Qualifying' : 'Race'),
            trackId: selectedTrack?.id,
            duration: formData.duration,
            maxLaps: formData.maxLaps,
            ...(isQualifyingSession ? {} : { gridFromQualifying: formData.useQualifyingGrid })
        }
        if (isQualifyingSession) {
            await startQualifying(params)
        } else {
            await startRace(params)
        }
        setSessionModalType(null)
    }

    const handleCancel = async () => {
        await stop()
        setShowCancelConfirm(false)
    }

    const handleDismiss = async () => {
        setShowResultsModal(false)
        await dismiss()
    }

    const canStartSession = selectedTrack && configuredCount > 0
    const sessionTypeLabel = isQualifying ? 'Qualifications' : isRace ? 'Course' : 'Session'

    // ===== SESSION ACTIVE (PENDING/RUNNING/PAUSED/RESULTS) =====
    if (!isIdle) {
        return (
            <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                <SessionHeader
                    sessionName={sessionName}
                    sessionTypeLabel={sessionTypeLabel}
                    state={state}
                    cuConnected={cuConnected}
                    elapsedFormatted={elapsedFormatted}
                    remaining={remaining}
                    remainingFormatted={remainingFormatted}
                    progress={progress}
                />

                <main className="flex-1 overflow-auto p-6">
                    <Leaderboard leaderboard={leaderboard} sessionType={sessionType} />
                </main>

                <SessionControls
                    isPending={isPending}
                    isRunning={isRunning}
                    isPaused={isPaused}
                    isResults={isResults}
                    showResultsModal={showResultsModal}
                    canStart={canStart}
                    canPause={canPause}
                    canResume={canResume}
                    canFinish={canFinish}
                    onStart={start}
                    onPause={pause}
                    onResume={resume}
                    onFinish={finish}
                    onShowCancel={() => setShowCancelConfirm(true)}
                    onShowResults={() => setShowResultsModal(true)}
                />

                {showCancelConfirm && (
                    <CancelConfirmModal
                        onClose={() => setShowCancelConfirm(false)}
                        onConfirm={handleCancel}
                    />
                )}

                {showResultsModal && isResults && (
                    <ResultsModal
                        sessionName={sessionName}
                        sessionTypeLabel={sessionTypeLabel}
                        leaderboard={leaderboard}
                        onDismiss={handleDismiss}
                    />
                )}
            </div>
        )
    }

    // ===== FREE PRACTICE (IDLE) =====
    return (
        <div className="h-full flex flex-col">
            <FreePracticeHeader
                state={state}
                tracks={tracks}
                selectedTrack={selectedTrack}
                onTrackChange={setSelectedTrack}
                cuConnected={cuConnected}
                canStartSession={canStartSession}
                onStartQualifying={() => setSessionModalType('qualifying')}
                onStartRace={() => setSessionModalType('race')}
            />

            <ControllerConfigSection
                expanded={configExpanded}
                onToggle={() => setConfigExpanded(!configExpanded)}
                configs={configs}
                drivers={drivers}
                cars={cars}
                onConfigChange={handleConfigChange}
                configLoading={configLoading}
                isComplete={isComplete}
                unconfiguredSlots={unconfiguredSlots}
            />

            <div className="flex-1 flex overflow-hidden">
                <FreePracticeLeaderboard
                    freePracticeBoard={freePracticeBoard}
                    configs={configs}
                    onReset={resetFreePracticeBoard}
                />

                <TrackRecordsPanel
                    selectedTrack={selectedTrack}
                    trackRecords={trackRecords}
                />
            </div>

            {sessionModalType && (
                <SessionModal
                    open
                    type={sessionModalType}
                    onClose={() => setSessionModalType(null)}
                    onStart={handleStartSession}
                />
            )}
        </div>
    )
}
