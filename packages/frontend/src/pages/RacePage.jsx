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
import SessionActionBar from '../components/race/SessionActionBar'
import Leaderboard from '../components/race/Leaderboard'

// Modals
import QualifyingModal from '../components/race/modals/QualifyingModal'
import RaceModal from '../components/race/modals/RaceModal'

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

    // Fetch track records when track changes
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

    // Refresh records periodically in free practice
    useEffect(() => {
        if (!isIdle || !selectedTrack?.id) return

        const interval = setInterval(() => {
            fetchTrackRecords(selectedTrack.id)
        }, 3000)

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

            <SessionActionBar
                canStartSession={canStartSession}
                selectedTrack={selectedTrack}
                cuConnected={cuConnected}
                configuredCount={configuredCount}
                onStartQualifying={() => setShowQualifyingModal(true)}
                onStartRace={() => setShowRaceModal(true)}
            />

            {showQualifyingModal && (
                <QualifyingModal
                    form={qualifyingForm}
                    setForm={setQualifyingForm}
                    championships={championships}
                    onClose={() => setShowQualifyingModal(false)}
                    onStart={handleStartQualifying}
                />
            )}

            {showRaceModal && (
                <RaceModal
                    form={raceForm}
                    setForm={setRaceForm}
                    championships={championships}
                    onClose={() => setShowRaceModal(false)}
                    onStart={handleStartRace}
                />
            )}
        </div>
    )
}
