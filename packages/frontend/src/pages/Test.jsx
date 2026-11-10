import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ControllerConfigPanel from '../components/cuTest/ControllerConfigPanel'
import CuControls from '../components/cuTest/CuControls'
import CuTestHeader from '../components/cuTest/CuTestHeader'
import TestLeaderboardPanel from '../components/cuTest/TestLeaderboardPanel'
import TestLogPanel from '../components/cuTest/TestLogPanel'
import * as api from '../components/cuTest/cuTestApi'
import {
  autoAssignControllers,
  controllerInfo,
  cuInfoLines,
  logEntry,
  recordLap,
  sortTestLeaderboard,
} from '../components/cuTest/cuTestModel'
import { useCuTestSocket } from '../components/cuTest/useCuTestSocket'

const STATUS_POLL_MS = 2000

// Diagnostics page: the Control Unit's commands and every event the server sends
export default function Test() {
  const { t } = useTranslation('test')
  const [logs, setLogs] = useState(() => [logEntry('info', 'APP', 'Page Test initialized')])
  const [connected, setConnected] = useState(false)
  const [cuConnected, setCuConnected] = useState(false)
  const [cuStatus, setCuStatus] = useState(null)
  const [leaderboard, setLeaderboard] = useState({})
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [controllerConfig, setControllerConfig] = useState({})
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [testSession, setTestSession] = useState(null)

  const addLog = (...args) => setLogs((prev) => [...prev, logEntry(...args)])
  const addLap = (lap) => setLeaderboard((prev) => recordLap(prev, lap))
  const cuGone = () => {
    setCuConnected(false)
    setCuStatus(null)
  }

  useEffect(() => {
    api
      .ensureTestSession()
      .then((session) => {
        if (!session) return
        setTestSession(session)
        setLogs((prev) => [
          ...prev,
          logEntry('success', 'SESSION', `Test session loaded: ${session.id.substring(0, 8)}...`),
        ])
      })
      .catch((err) =>
        setLogs((prev) => [...prev, logEntry('error', 'SESSION', `Failed to load test session: ${err.message}`)])
      )

    api
      .loadDriversAndCars()
      .then(({ drivers, cars }) => {
        setDrivers(drivers)
        setCars(cars)
        if (drivers.length > 0) setControllerConfig((prev) => autoAssignControllers(drivers, cars, prev))
      })
      .catch(() => {})
  }, [])

  // The Control Unit's state, polled
  useEffect(() => {
    const poll = () =>
      api
        .getBluetoothStatus()
        .then((data) => {
          setCuConnected(data.connected)
          if (data.lastStatus) setCuStatus(data.lastStatus)
        })
        .catch(() => {})
    poll()
    const interval = setInterval(poll, STATUS_POLL_MS)
    return () => clearInterval(interval)
  }, [])

  useCuTestSocket({
    connect: (_, socket) => {
      setConnected(true)
      addLog('success', 'SOCKET', `Connected (id: ${socket.id})`)
    },
    disconnect: (reason) => {
      setConnected(false)
      addLog('error', 'SOCKET', `Disconnected: ${reason}`)
    },
    connect_error: (error) => addLog('error', 'SOCKET', `Connection error: ${error.message}`),
    'lap:completed': (data) => {
      addLog('lap', 'LAP', `Lap completed - Car ${data.controller || data.carId}`, data)
      addLap(data)
    },
    lap_completed: (data) => {
      addLog('lap', 'LAP', `Lap completed (alt) - Car ${data.controller || data.carId}`, data)
      addLap(data)
    },
    'race:status': (data) => addLog('status', 'RACE', `Status: ${data.active ? 'RUNNING' : 'STOPPED'}`, data),
    'cu:connected': () => {
      setCuConnected(true)
      addLog('success', 'BLE', 'Control Unit connected')
    },
    'cu:disconnected': () => {
      cuGone()
      addLog('error', 'BLE', 'Control Unit disconnected')
    },
    'cu:status': setCuStatus,
    'cu:timer': (data) => {
      if (!data.isFinishLine) {
        addLog('info', 'BLE', `Car ${data.controller} Sector ${data.sector}`, data)
        return
      }
      const lapTime = data.lapTime > 0 ? ` - Lap: ${(data.lapTime / 1000).toFixed(3)}s` : ' (first pass)'
      addLog('lap', 'BLE', `Car ${data.controller} Finish${lapTime}`, data)
      if (data.lapTime > 0) addLap({ controller: data.controller, lapTime: data.lapTime })
    },
    'cu:reconnect-failed': () => addLog('error', 'BLE', 'Reconnection failed'),
    'session:started': (data) => addLog('success', 'SESSION', `Session started: ${data.sessionId}`, data),
    'session:stopped': (data) => addLog('info', 'SESSION', `Session stopped: ${data.sessionId}`, data),
    'phase:started': (data) => addLog('success', 'PHASE', `Phase started: ${data.phase}`, data),
    'positions:updated': (data) => addLog('status', 'POS', 'Positions updated', data),
    onUnknown: (event, data) => addLog('info', 'UNKNOWN', `Event: ${event}`, data),
  })

  async function command(endpoint, body) {
    setBusy(endpoint)
    try {
      const data = await api.callBluetooth(endpoint, body)
      if (data.success) addLog('success', 'APP', data.message || `${endpoint} OK`)
      else addLog('error', 'APP', `${endpoint} failed: ${data.error}`)
      return data
    } catch (err) {
      addLog('error', 'APP', `${endpoint} error: ${err.message}`)
      return { success: false, error: err.message }
    } finally {
      setBusy(null)
    }
  }

  async function scan() {
    setScanning(true)
    addLog('info', 'APP', 'Scanning for Control Unit...')
    const data = await command('/scan', { autoConnect: true })
    if (data.success) setCuConnected(true)
    setScanning(false)
  }

  async function disconnect() {
    await command('/disconnect')
    cuGone()
  }

  async function showInfo() {
    try {
      const data = await api.getBluetoothInfo()
      if (!data.success) {
        addLog('error', 'APP', `Info failed: ${data.error}`)
        return
      }
      cuInfoLines(data.data).forEach((line, i) => addLog('info', 'APP', line, i === 0 ? data.data : null))
    } catch (err) {
      addLog('error', 'APP', `Info failed: ${err.message}`)
    }
  }

  function assign(controller, field, value) {
    setControllerConfig((prev) => ({ ...prev, [controller]: { ...prev[controller], [field]: value } }))
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <CuTestHeader connected={connected} cuConnected={cuConnected} cuStatus={cuStatus} testSession={testSession} />
      <CuControls
        cuConnected={cuConnected}
        cuStatus={cuStatus}
        scanning={scanning}
        busy={busy}
        showConfig={showConfig}
        onScan={scan}
        onCommand={command}
        onInfo={showInfo}
        onDisconnect={disconnect}
        onToggleConfig={() => setShowConfig(!showConfig)}
      />
      {showConfig && (
        <ControllerConfigPanel config={controllerConfig} drivers={drivers} cars={cars} onChange={assign} />
      )}

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        <TestLogPanel logs={logs} onClear={() => setLogs([])} />
        <TestLeaderboardPanel
          entries={sortTestLeaderboard(leaderboard)}
          infoOf={(controller) => controllerInfo(controller, controllerConfig, drivers, cars, t)}
          onClear={() => setLeaderboard({})}
        />
      </div>
    </div>
  )
}
