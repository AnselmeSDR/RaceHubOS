import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import {
  SignalIcon,
  SignalSlashIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  XMarkIcon,
  BoltIcon,
  UserIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { API_URL, CONTROLLER_COLORS, CU_BUTTONS, MODE_FLAGS } from '../constants'

// Auto-assign drivers/cars to controllers based on DB data
const autoAssignControllers = (drivers, cars, currentConfig) => {
  // Only auto-assign if config is empty
  if (Object.keys(currentConfig).length > 0) return currentConfig

  const newConfig = {}
  drivers.forEach((driver, index) => {
    const controller = index + 1
    if (controller <= 8) {
      newConfig[controller] = {
        driverId: driver.id,
        carId: cars[index]?.id || null
      }
    }
  })

  return newConfig
}

export default function Test() {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const [cuConnected, setCuConnected] = useState(false)
  const [cuStatus, setCuStatus] = useState(null)
  const [leaderboard, setLeaderboard] = useState({})
  const [filter, setFilter] = useState('all')
  const [groupByType, setGroupByType] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [controllerConfig, setControllerConfig] = useState({})
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const socketRef = useRef(null)
  const logsEndRef = useRef(null)

  // Load drivers and cars from API
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/drivers`).then(res => res.json()),
      fetch(`${API_URL}/api/cars`).then(res => res.json())
    ]).then(([driversData, carsData]) => {
      const loadedDrivers = driversData.data || []
      const loadedCars = carsData.data || []
      setDrivers(loadedDrivers)
      setCars(loadedCars)

      // Auto-assign if config is empty
      if (loadedDrivers.length > 0) {
        setControllerConfig(prev => {
          const newConfig = autoAssignControllers(loadedDrivers, loadedCars, prev)
          return newConfig
        })
      }
    }).catch(() => {})
  }, [])

  const addLog = (type, source, message, data = null) => {
    const timestamp = new Date().toISOString()
    setLogs(prev => [...prev, { timestamp, type, source, message, data }])
  }

  // Get driver/car name from config or default
  const getControllerInfo = (controller) => {
    const config = controllerConfig[controller]
    if (config) {
      // Find driver and car from loaded data
      const driver = config.driverId ? drivers.find(d => d.id === config.driverId) : null
      const car = config.carId ? cars.find(c => c.id === config.carId) : null
      return {
        driverName: driver?.name || config.driverName || `Driver ${controller}`,
        carName: car ? `${car.brand} ${car.model}` : config.carName || `Car ${controller}`,
        color: car?.color || driver?.color || config.color || CONTROLLER_COLORS[controller] || '#888'
      }
    }
    return {
      driverName: `Driver ${controller}`,
      carName: `Car ${controller}`,
      color: CONTROLLER_COLORS[controller] || '#888'
    }
  }

  const updateLeaderboard = (lapData) => {
    setLeaderboard(prev => {
      const key = lapData.controller || lapData.carId || 'unknown'
      const existing = prev[key] || { laps: 0, bestLap: null, lastLap: null, totalTime: 0 }

      const lapTime = lapData.lapTime || lapData.time
      const newLaps = (lapData.lapNumber || existing.laps + 1)
      const newBestLap = existing.bestLap === null
        ? lapTime
        : Math.min(existing.bestLap, lapTime)

      return {
        ...prev,
        [key]: {
          ...existing,
          controller: key,
          laps: newLaps,
          lastLap: lapTime,
          bestLap: newBestLap,
          totalTime: existing.totalTime + lapTime,
          lastUpdate: Date.now()
        }
      }
    })
  }

  // Update controller config
  const updateControllerConfig = (controller, field, value) => {
    setControllerConfig(prev => {
      const newConfig = {
        ...prev,
        [controller]: {
          ...prev[controller],
          [field]: value
        }
      }
      return newConfig
    })
  }

  useEffect(() => {
    addLog('info', 'APP', 'Page Test initialized')
    addLog('info', 'APP', `Connecting to ${API_URL}...`)

    const socket = io(API_URL)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      addLog('success', 'SOCKET', `Connected (id: ${socket.id})`)
    })

    socket.on('disconnect', (reason) => {
      setConnected(false)
      addLog('error', 'SOCKET', `Disconnected: ${reason}`)
    })

    socket.on('connect_error', (error) => {
      addLog('error', 'SOCKET', `Connection error: ${error.message}`)
    })

    // Lap events
    socket.on('lap:completed', (data) => {
      addLog('lap', 'LAP', `Lap completed - Car ${data.controller || data.carId}`, data)
      updateLeaderboard(data)
    })

    socket.on('lap_completed', (data) => {
      addLog('lap', 'LAP', `Lap completed (alt) - Car ${data.controller || data.carId}`, data)
      updateLeaderboard(data)
    })

    socket.on('race:lap', (data) => {
      addLog('lap', 'RACE', `Race lap - Car ${data.carId}`, data)
      updateLeaderboard({ controller: data.carId, lapTime: data.lapTime, lapNumber: data.lapNumber })
    })

    // Race events
    socket.on('race:status', (data) => {
      addLog('status', 'RACE', `Status: ${data.active ? 'RUNNING' : 'STOPPED'}`, data)
    })

    // CU/Bluetooth events
    socket.on('cu:connected', () => {
      setCuConnected(true)
      addLog('success', 'BLE', 'Control Unit connected')
    })

    socket.on('cu:disconnected', () => {
      setCuConnected(false)
      setCuStatus(null)
      addLog('error', 'BLE', 'Control Unit disconnected')
    })

    socket.on('cu:status', (data) => {
      setCuStatus(data)
    })

    socket.on('cu:timer', (data) => {
      const lapTimeStr = data.lapTime > 0 ? ` - Lap: ${(data.lapTime / 1000).toFixed(3)}s` : ' (first pass)'
      addLog('lap', 'BLE', `Timer Car ${data.controller}${lapTimeStr}`, data)
      if (data.lapTime > 0) {
        updateLeaderboard({ controller: data.controller, lapTime: data.lapTime })
      }
    })

    socket.on('cu:reconnect-failed', () => {
      addLog('error', 'BLE', 'Reconnection failed')
    })

    // Session events
    socket.on('session:started', (data) => {
      addLog('success', 'SESSION', `Session started: ${data.sessionId}`, data)
    })

    socket.on('session:stopped', (data) => {
      addLog('info', 'SESSION', `Session stopped: ${data.sessionId}`, data)
    })

    // Phase events
    socket.on('phase:started', (data) => {
      addLog('success', 'PHASE', `Phase started: ${data.phase}`, data)
    })

    // Positions
    socket.on('positions:updated', (data) => {
      addLog('status', 'POS', `Positions updated`, data)
    })

    // Catch-all for unknown events
    const originalOnevent = socket.onevent
    socket.onevent = function(packet) {
      const eventName = packet.data[0]
      const knownEvents = [
        'connect', 'disconnect', 'connect_error',
        'lap:completed', 'lap_completed', 'race:lap',
        'race:status', 'cu:connected', 'cu:disconnected', 'cu:status', 'cu:timer', 'cu:reconnect-failed',
        'session:started', 'session:stopped', 'phase:started', 'positions:updated'
      ]
      if (!knownEvents.includes(eventName)) {
        addLog('info', 'UNKNOWN', `Event: ${eventName}`, packet.data[1])
      }
      originalOnevent.call(socket, packet)
    }

    return () => {
      socket.disconnect()
    }
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const clearLogs = () => setLogs([])
  const clearLeaderboard = () => setLeaderboard({})

  // Fetch initial CU status
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bluetooth/status`)
      const data = await res.json()
      setCuConnected(data.connected)
      if (data.lastStatus) setCuStatus(data.lastStatus)
    } catch { /* ignore */ }
  }

  // CU Control functions
  const apiCall = async (endpoint, method = 'POST', body = null) => {
    setActionLoading(endpoint)
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } }
      if (body) options.body = JSON.stringify(body)
      const res = await fetch(`${API_URL}/api/bluetooth${endpoint}`, options)
      const data = await res.json()
      if (data.success) {
        addLog('success', 'APP', data.message || `${endpoint} OK`)
      } else {
        addLog('error', 'APP', `${endpoint} failed: ${data.error}`)
      }
      return data
    } catch (err) {
      addLog('error', 'APP', `${endpoint} error: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setActionLoading(null)
    }
  }

  const scanAndConnect = async () => {
    setLoading(true)
    addLog('info', 'APP', 'Scanning for Control Unit...')
    const data = await apiCall('/scan', 'POST', { autoConnect: true })
    if (data.success) setCuConnected(true)
    setLoading(false)
  }

  const disconnect = async () => {
    await apiCall('/disconnect')
    setCuConnected(false)
    setCuStatus(null)
  }

  const formatTime = (ms) => {
    if (!ms) return '-'
    return (ms / 1000).toFixed(3) + 's'
  }

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'lap': return 'text-yellow-400'
      case 'status': return 'text-blue-400'
      default: return 'text-gray-300'
    }
  }

  const getSourceBadge = (source) => {
    const colors = {
      APP: 'bg-gray-600',
      SOCKET: 'bg-purple-600',
      LAP: 'bg-yellow-600',
      RACE: 'bg-green-600',
      BLE: 'bg-blue-600',
      SESSION: 'bg-orange-600',
      PHASE: 'bg-pink-600',
      POS: 'bg-cyan-600',
      UNKNOWN: 'bg-red-600'
    }
    return colors[source] || 'bg-gray-600'
  }

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.type === filter || log.source.toLowerCase() === filter)

  // Group logs by type for grouped view
  const groupedLogs = groupByType
    ? filteredLogs.reduce((acc, log) => {
        const key = log.type
        if (!acc[key]) acc[key] = []
        acc[key].push(log)
        return acc
      }, {})
    : null

  const logTypes = ['success', 'error', 'lap', 'status', 'info']

  const sortedLeaderboard = Object.values(leaderboard).sort((a, b) => {
    if (b.laps !== a.laps) return b.laps - a.laps
    if (!a.bestLap) return 1
    if (!b.bestLap) return -1
    return a.bestLap - b.bestLap
  })

  // Decode CU status
  const getRaceState = () => {
    if (!cuStatus) return { text: 'Unknown', color: 'gray' }
    const start = cuStatus.start
    if (start === 0) return { text: 'Racing', color: 'green' }
    if (start >= 1 && start <= 5) return { text: `Lights ${start}/5`, color: 'yellow' }
    if (start === 6) return { text: 'False Start', color: 'red' }
    if (start === 7) return { text: 'Go!', color: 'green' }
    if (start >= 8) return { text: 'Stopped', color: 'red' }
    return { text: `State ${start}`, color: 'gray' }
  }

  const getModes = () => {
    if (!cuStatus) return []
    const modes = []
    if (cuStatus.mode & MODE_FLAGS.FUEL) modes.push('Fuel')
    if (cuStatus.mode & MODE_FLAGS.REAL) modes.push('Real')
    if (cuStatus.mode & MODE_FLAGS.PIT_LANE) modes.push('Pit Lane')
    if (cuStatus.mode & MODE_FLAGS.LAP_COUNTER) modes.push('Lap Counter')
    return modes
  }

  const raceState = getRaceState()
  const modes = getModes()

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Test Console</h1>
          {/* Socket status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            connected ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
          }`}>
            {connected ? <SignalIcon className="w-4 h-4" /> : <SignalSlashIcon className="w-4 h-4" />}
            {connected ? 'Socket OK' : 'Socket Off'}
          </div>
          {/* CU status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            cuConnected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            <BoltIcon className="w-4 h-4" />
            {cuConnected ? 'CU Connected' : 'CU Offline'}
          </div>
          {/* Race state */}
          {cuConnected && (
            <div className={`px-3 py-1 rounded-full text-sm font-bold bg-${raceState.color}-100 text-${raceState.color}-700`}>
              {raceState.text}
            </div>
          )}
          {/* Modes */}
          {modes.length > 0 && (
            <div className="flex gap-1">
              {modes.map(m => (
                <span key={m} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CU Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 dark:text-gray-200">Control Unit</span>
            {!cuConnected ? (
              <button
                onClick={scanAndConnect}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <SignalIcon className="w-4 h-4" />}
                Scan & Connect
              </button>
            ) : (
              <>
                {/* Main controls */}
                {cuStatus?.start === 0 ? (
                  <button
                    onClick={() => apiCall('/start-race')}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold"
                  >
                    <StopIcon className="w-5 h-5" />
                    STOP
                  </button>
                ) : (
                  <button
                    onClick={() => apiCall('/start-race')}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <PlayIcon className="w-4 h-4" />
                    START
                  </button>
                )}
                <button
                  onClick={() => apiCall('/esc')}
                  disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
                >
                  ESC
                </button>
                <button
                  onClick={() => apiCall('/reset-timer')}
                  disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Reset Timer
                </button>
                <button
                  onClick={() => apiCall('/clear-position')}
                  disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Clear Pos
                </button>

                {/* CU Buttons */}
                <div className="border-l dark:border-gray-600 pl-2 ml-2 flex gap-1">
                  {Object.entries(CU_BUTTONS).map(([name, id]) => (
                    <button
                      key={id}
                      onClick={() => apiCall(`/button/${id}`)}
                      disabled={actionLoading}
                      className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 text-xs"
                      title={`Button ${id}: ${name}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {/* Disconnect */}
                <button
                  onClick={disconnect}
                  disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 ml-2"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Disconnect
                </button>
              </>
            )}
          </div>

          {/* Status info */}
          {cuConnected && cuStatus && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4">
              <span>Display: {cuStatus.display || 6} cars</span>
              {cuStatus.fuel && (
                <span>Fuel: [{cuStatus.fuel.slice(0, cuStatus.display || 6).join(', ')}]</span>
              )}
            </div>
          )}

          {/* Config toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg ${showConfig ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'} hover:bg-blue-200 dark:hover:bg-blue-900/70`}
          >
            <Cog6ToothIcon className="w-4 h-4" />
            Config
          </button>
        </div>
      </div>

      {/* Controller Configuration Panel */}
      {showConfig && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Configuration des Controllers
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(controller => {
              const config = controllerConfig[controller] || {}
              const color = CONTROLLER_COLORS[controller]
              return (
                <div key={controller} className="border dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-bold text-sm text-gray-900 dark:text-white">Controller {controller}</span>
                  </div>
                  <div className="space-y-2">
                    <select
                      value={config.driverId || ''}
                      onChange={(e) => updateControllerConfig(controller, 'driverId', e.target.value)}
                      className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-600 dark:text-white"
                    >
                      <option value="">-- Pilote --</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          #{d.number} {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={config.carId || ''}
                      onChange={(e) => updateControllerConfig(controller, 'carId', e.target.value)}
                      className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-600 dark:text-white"
                    >
                      <option value="">-- Voiture --</option>
                      {cars.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.brand} {c.model}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Configuration sauvegardée automatiquement. {drivers.length} pilotes, {cars.length} voitures disponibles.
          </p>
        </div>
      )}

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Logs Panel */}
        <div className="col-span-2 bg-gray-900 rounded-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">Logs</span>
              <span className="text-gray-400 text-sm">({filteredLogs.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupByType(!groupByType)}
                className={`px-2 py-1 text-sm rounded ${groupByType ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}
              >
                {groupByType ? 'Groupé' : 'Chrono'}
              </button>
              {!groupByType && (
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                >
                  <option value="all">All</option>
                  <option value="lap">Laps</option>
                  <option value="status">Status</option>
                  <option value="error">Errors</option>
                  <option value="success">Success</option>
                  <option value="info">Info</option>
                </select>
              )}
              <button
                onClick={clearLogs}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Clear logs"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Waiting for events...
              </div>
            ) : groupByType ? (
              // Grouped view by type
              <div className="space-y-4">
                {logTypes.map(type => {
                  const typeLogs = groupedLogs[type] || []
                  if (typeLogs.length === 0) return null
                  return (
                    <div key={type}>
                      <div className={`sticky top-0 py-1 px-2 rounded font-bold uppercase text-xs mb-1 ${getLogColor(type)} bg-gray-800`}>
                        {type} ({typeLogs.length})
                      </div>
                      <div className="space-y-1 pl-2 border-l-2 border-gray-700">
                        {typeLogs.map((log, i) => (
                          <div key={i} className={`flex items-start gap-2 ${getLogColor(log.type)}`}>
                            <span className="text-gray-500 flex-shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] text-white flex-shrink-0 ${getSourceBadge(log.source)}`}>
                              {log.source}
                            </span>
                            <span className="flex-1">{log.message}</span>
                            {log.data && (
                              <button
                                onClick={() => console.log(log.data)}
                                className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                                title="Log data to console"
                              >
                                [data]
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Chronological view
              <div className="space-y-1">
                {filteredLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 ${getLogColor(log.type)}`}>
                    <span className="text-gray-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] text-white flex-shrink-0 ${getSourceBadge(log.source)}`}>
                      {log.source}
                    </span>
                    <span className="flex-1">{log.message}</span>
                    {log.data && (
                      <button
                        onClick={() => console.log(log.data)}
                        className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                        title="Log data to console"
                      >
                        [data]
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Leaderboard Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
            <span className="font-semibold text-gray-800 dark:text-white">Live Leaderboard</span>
            <button
              onClick={clearLeaderboard}
              className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 dark:text-gray-400"
              title="Clear leaderboard"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sortedLeaderboard.length === 0 ? (
              <div className="text-gray-400 text-center py-8 text-sm">
                No lap data yet
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr className="text-left text-gray-500 dark:text-gray-400 text-xs">
                    <th className="px-3 py-2">Pos</th>
                    <th className="px-3 py-2">Car</th>
                    <th className="px-3 py-2 text-right">Laps</th>
                    <th className="px-3 py-2 text-right">Best</th>
                    <th className="px-3 py-2 text-right">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((entry, index) => {
                    const info = getControllerInfo(entry.controller)
                    return (
                      <tr
                        key={entry.controller}
                        className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          Date.now() - entry.lastUpdate < 3000 ? 'bg-yellow-50 dark:bg-yellow-900/30' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">{index + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500 flex-shrink-0"
                              style={{ backgroundColor: info.color }}
                            />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{info.driverName}</div>
                              <div className="text-xs text-gray-400">{info.carName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{entry.laps}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-600 dark:text-green-400">
                          {formatTime(entry.bestLap)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-300">
                          {formatTime(entry.lastLap)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {sortedLeaderboard.length > 0 && (
            <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Total Laps: {sortedLeaderboard.reduce((s, e) => s + e.laps, 0)}</span>
                <span>Cars: {sortedLeaderboard.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
