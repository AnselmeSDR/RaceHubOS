import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  SignalIcon,
  SignalSlashIcon,
  PlayIcon,
  ClockIcon,
  FlagIcon,
  TrophyIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { useRace } from '../context/RaceContext'
import { useControllerConfig } from '../hooks/useControllerConfig'
import ConfigPanel from '../components/config/ConfigPanel'
import ConfigStatus from '../components/config/ConfigStatus'
import StateChip from '../components/race/StateChip'
import LapTime from '../components/race/LapTime'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function FreePractice() {
  const navigate = useNavigate()
  const { state, cuConnected, startQualifying, startRace } = useRace()

  // Data fetching
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])
  const [championships, setChampionships] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)

  // Live data
  const [liveLaps, setLiveLaps] = useState([])
  const [trackRecords, setTrackRecords] = useState([])

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

  // Modals
  const [showQualifyingModal, setShowQualifyingModal] = useState(false)
  const [showRaceModal, setShowRaceModal] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)

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

        // Auto-select first track if available
        if (tracksData.data?.length > 0 && !selectedTrack) {
          setSelectedTrack(tracksData.data[0])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [])

  const fetchTrackRecords = useCallback(async (trackId) => {
    try {
      const response = await fetch(`${API_URL}/api/laps/records?trackId=${trackId}`)
      const data = await response.json()
      setTrackRecords(data.data || [])
    } catch (error) {
      console.error('Error fetching track records:', error)
    }
  }, [])

  // Fetch track records when track changes
  useEffect(() => {
    if (selectedTrack?.id) {
      fetchTrackRecords(selectedTrack.id)
      fetchConfigs(selectedTrack.id)
    }
  }, [selectedTrack?.id, fetchConfigs, fetchTrackRecords])

  const addLiveLap = useCallback((lapData) => {
    const controller = lapData.controller || lapData.carId
    const config = configs.find(c => c.controller === controller)
    const driver = config?.driver
      ? (typeof config.driver === 'object' ? config.driver : drivers.find(d => d.id === config.driver))
      : null

    const lap = {
      id: Date.now() + Math.random(),
      controller,
      driverName: driver?.name || `Controller ${controller}`,
      lapTime: lapData.lapTime || lapData.time,
      timestamp: lapData.timestamp || Date.now()
    }

    setLiveLaps(prev => [lap, ...prev].slice(0, 20))
  }, [configs, drivers])

  // Subscribe to live lap events
  useEffect(() => {
    const socket = io(API_URL)

    socket.on('lap:completed', (data) => {
      addLiveLap(data)
    })

    socket.on('lap_completed', (data) => {
      addLiveLap(data)
    })

    socket.on('cu:timer', (data) => {
      if (data.lapTime > 0) {
        addLiveLap({
          controller: data.controller,
          lapTime: data.lapTime,
          timestamp: Date.now()
        })
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [addLiveLap])

  // Handle config change
  const handleConfigChange = useCallback((controller, driverId, carId) => {
    updateSlot(controller, driverId, carId)
  }, [updateSlot])

  // Start qualifying session
  const handleStartQualifying = async () => {
    const params = {
      name: qualifyingForm.name || 'Qualifying',
      trackId: selectedTrack?.id,
      type: 'qualif',
      duration: qualifyingForm.duration > 0 ? qualifyingForm.duration * 60 * 1000 : null,
      maxLaps: qualifyingForm.maxLaps > 0 ? qualifyingForm.maxLaps : null,
      championshipId: qualifyingForm.championshipId || null,
      controllers: configs.filter(c => c.driver && c.car)
    }

    const result = await startQualifying(params)
    if (result.success !== false) {
      setShowQualifyingModal(false)
      navigate('/race')
    }
  }

  // Start race session
  const handleStartRace = async () => {
    const params = {
      name: raceForm.name || 'Race',
      trackId: selectedTrack?.id,
      type: 'race',
      duration: raceForm.duration > 0 ? raceForm.duration * 60 * 1000 : null,
      maxLaps: raceForm.maxLaps > 0 ? raceForm.maxLaps : null,
      championshipId: raceForm.championshipId || null,
      useQualifyingGrid: raceForm.useQualifyingGrid,
      controllers: configs.filter(c => c.driver && c.car)
    }

    const result = await startRace(params)
    if (result.success !== false) {
      setShowRaceModal(false)
      navigate('/race')
    }
  }

  const canStartSession = selectedTrack && cuConnected && configuredCount > 0

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Free Practice</h1>
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
                className="appearance-none bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select track...</option>
                {tracks.map(track => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* CU Connection status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              cuConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {cuConnected ? (
                <SignalIcon className="w-5 h-5" />
              ) : (
                <SignalSlashIcon className="w-5 h-5" />
              )}
              <span className="font-medium text-sm">
                {cuConnected ? 'CU Connected' : 'CU Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Controller Configuration */}
      <div className="bg-white border-b">
        <button
          onClick={() => setConfigExpanded(!configExpanded)}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">Controller Configuration</span>
            <ConfigStatus
              isComplete={isComplete}
              unconfiguredCount={unconfiguredSlots.length}
              unconfiguredSlots={unconfiguredSlots}
            />
          </div>
          {configExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {configExpanded && (
          <div className="px-6 pb-4 border-t bg-gray-50">
            <div className="pt-4">
              <ConfigPanel
                configs={configs.reduce((acc, c) => {
                  acc[c.controller] = c
                  return acc
                }, {})}
                drivers={drivers}
                cars={cars}
                onConfigChange={handleConfigChange}
                disabled={configLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main content - 2 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Live lap feed */}
        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-blue-500" />
                Live Lap Times
              </h2>
              <span className="text-sm text-gray-500">
                Last 20 laps
              </span>
            </div>

            <div className="divide-y">
              {liveLaps.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-400">
                  <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Waiting for lap times...</p>
                  <p className="text-sm mt-1">Drive on track to see lap times here</p>
                </div>
              ) : (
                liveLaps.map((lap, index) => (
                  <div
                    key={lap.id}
                    className={`px-4 py-3 flex items-center justify-between ${
                      index === 0 ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono w-16">
                        {formatTimestamp(lap.timestamp)}
                      </span>
                      <span className="font-medium text-gray-800">
                        {lap.driverName}
                      </span>
                    </div>
                    <LapTime time={lap.lapTime} size={index === 0 ? 'lg' : 'md'} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar: Track Records */}
        <div className="w-72 border-l bg-white overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrophyIcon className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-gray-800">Track Records</h2>
          </div>

          {!selectedTrack ? (
            <div className="text-center text-gray-400 py-8">
              <p>Select a track to see records</p>
            </div>
          ) : trackRecords.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <TrophyIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No records yet</p>
              <p className="text-sm mt-1">on {selectedTrack.name}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trackRecords.map((record, index) => (
                <div
                  key={record.id || index}
                  className={`p-3 rounded-lg ${
                    index === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">
                      {record.driver?.name || 'Unknown'}
                    </span>
                    {index === 0 && (
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold">
                        RECORD
                      </span>
                    )}
                  </div>
                  <LapTime time={record.lapTime || record.time} size="lg" />
                  {record.car && (
                    <p className="text-xs text-gray-500 mt-1">
                      {record.car.brand} {record.car.model}
                    </p>
                  )}
                </div>
              ))}
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
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ClockIcon className="w-5 h-5" />
            Start Qualifying
          </button>

          <button
            onClick={() => setShowRaceModal(true)}
            disabled={!canStartSession}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FlagIcon className="w-5 h-5" />
            Start Race
          </button>
        </div>

        {!canStartSession && (
          <p className="text-center text-sm text-gray-500 mt-2">
            {!selectedTrack && 'Select a track to start a session. '}
            {!cuConnected && 'Control Unit not connected. '}
            {configuredCount === 0 && 'Configure at least one controller. '}
          </p>
        )}
      </div>

      {/* Qualifying Modal */}
      {showQualifyingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Start Qualifying</h2>
              <button
                onClick={() => setShowQualifyingModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Name (optional)
                </label>
                <input
                  type="text"
                  value={qualifyingForm.name}
                  onChange={(e) => setQualifyingForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Qualifying"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={qualifyingForm.duration}
                    onChange={(e) => setQualifyingForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Laps
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={qualifyingForm.maxLaps}
                    onChange={(e) => setQualifyingForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Championship (optional)
                </label>
                <select
                  value={qualifyingForm.championshipId || ''}
                  onChange={(e) => setQualifyingForm(f => ({ ...f, championshipId: e.target.value || null }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  {championships.map(champ => (
                    <option key={champ.id} value={champ.id}>
                      {champ.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowQualifyingModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleStartQualifying}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                <PlayIcon className="w-5 h-5" />
                Start
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
              <h2 className="text-xl font-bold text-gray-800">Start Race</h2>
              <button
                onClick={() => setShowRaceModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Race Name (optional)
                </label>
                <input
                  type="text"
                  value={raceForm.name}
                  onChange={(e) => setRaceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Race"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={raceForm.duration}
                    onChange={(e) => setRaceForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Laps
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={raceForm.maxLaps}
                    onChange={(e) => setRaceForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Championship (optional)
                </label>
                <select
                  value={raceForm.championshipId || ''}
                  onChange={(e) => setRaceForm(f => ({ ...f, championshipId: e.target.value || null }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">None</option>
                  {championships.map(champ => (
                    <option key={champ.id} value={champ.id}>
                      {champ.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useQualifyingGrid"
                  checked={raceForm.useQualifyingGrid}
                  onChange={(e) => setRaceForm(f => ({ ...f, useQualifyingGrid: e.target.checked }))}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="useQualifyingGrid" className="text-sm text-gray-700">
                  Use grid from last qualifying session
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRaceModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRace}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                <FlagIcon className="w-5 h-5" />
                Start Race
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
