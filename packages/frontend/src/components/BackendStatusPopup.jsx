import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, ArrowPathIcon, BoltIcon, SignalIcon, SignalSlashIcon, ServerIcon, TrashIcon } from '@heroicons/react/24/outline'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

const LOG_TYPES = ['info', 'warn', 'error', 'debug']

/**
 * BackendStatusPopup - Modal showing backend/CU/simulator status and logs
 */
export default function BackendStatusPopup({ isOpen, onClose }) {
    const [backendStatus, setBackendStatus] = useState(null)
    const [cuStatus, setCuStatus] = useState(null)
    const [simulatorStatus, setSimulatorStatus] = useState(null)
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [groupByType, setGroupByType] = useState(false)
    const [filter, setFilter] = useState('all')
    const logsEndRef = useRef(null)
    const socketRef = useRef(null)

    // Fetch initial status
    useEffect(() => {
        if (!isOpen) return

        const fetchStatus = async () => {
            setLoading(true)
            try {
                const [healthRes, btRes, simRes] = await Promise.all([
                    fetch(`${API_URL}/health`),
                    fetch(`${API_URL}/api/bluetooth/status`),
                    fetch(`${API_URL}/api/simulator`)
                ])

                const [health, bt, sim] = await Promise.all([
                    healthRes.json(),
                    btRes.json(),
                    simRes.json()
                ])

                setBackendStatus(health)
                setCuStatus(bt)
                setSimulatorStatus(sim)

                addLog('info', `Backend: ${health.status} (v${health.version})`)
                if (sim.isMockDevice) {
                    addLog('info', `Mode simulateur: ${sim.running ? 'En cours' : 'Arrêté'}`)
                } else if (bt.connected) {
                    addLog('info', `CU connecté`)
                } else {
                    addLog('warn', 'CU non connecté')
                }
            } catch (error) {
                addLog('error', `Erreur connexion backend: ${error.message}`)
                setBackendStatus(null)
            } finally {
                setLoading(false)
            }
        }

        fetchStatus()
    }, [isOpen])

    // WebSocket for real-time logs
    useEffect(() => {
        if (!isOpen) return

        const socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true
        })
        socketRef.current = socket

        socket.on('connect', () => {
            addLog('info', 'WebSocket connecté')
        })

        socket.on('disconnect', () => {
            addLog('warn', 'WebSocket déconnecté')
        })

        socket.on('cu:connected', () => {
            addLog('info', 'CU connecté')
        })

        socket.on('cu:disconnected', () => {
            addLog('warn', 'CU déconnecté')
        })

        socket.on('cu:status', (status) => {
            const stateNames = {
                0: 'Racing',
                1: 'Lights 1/5',
                2: 'Lights 2/5',
                3: 'Lights 3/5',
                4: 'Lights 4/5',
                5: 'Lights 5/5',
                6: 'False Start',
                7: 'Go!',
                9: 'Stopped'
            }
            const stateName = stateNames[status.start] || `State ${status.start}`
            addLog('debug', `CU Status: ${stateName}, Mode: ${status.mode}`)
        })

        socket.on('cu:timer', (data) => {
            addLog('debug', `Timer: Ctrl ${data.controller} - ${data.lapTime}ms`)
        })

        socket.on('lap:completed', (lap) => {
            const driverName = lap.driver?.name || `Ctrl ${lap.controller}`
            const time = (lap.lapTime / 1000).toFixed(3)
            addLog('info', `Tour: ${driverName} - ${time}s`)
        })

        socket.on('session:started', ({ sessionId }) => {
            addLog('info', `Session démarrée: ${sessionId.substring(0, 8)}...`)
        })

        socket.on('session:stopped', ({ sessionId }) => {
            addLog('info', `Session arrêtée: ${sessionId.substring(0, 8)}...`)
        })

        socket.on('race:lap', (data) => {
            addLog('debug', `Sim Lap: Car ${data.carId} - ${(data.lapTime / 1000).toFixed(3)}s`)
        })

        return () => {
            socket.disconnect()
        }
    }, [isOpen])

    // Auto-scroll only if already at bottom
    const logsContainerRef = useRef(null)
    const [autoScroll, setAutoScroll] = useState(true)

    const handleScroll = () => {
        if (!logsContainerRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
        // If within 50px of bottom, enable auto-scroll
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
    }

    useEffect(() => {
        if (autoScroll) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, autoScroll])

    const addLog = (level, message) => {
        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false })
        setLogs(prev => [...prev, { timestamp, level, message }])
    }

    // Filter logs
    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(log => log.level === filter)

    // Group logs by type for grouped view
    const groupedLogs = groupByType
        ? filteredLogs.reduce((acc, log) => {
            const key = log.level
            if (!acc[key]) acc[key] = []
            acc[key].push(log)
            return acc
        }, {})
        : null

    const clearLogs = () => {
        setLogs([])
        addLog('info', 'Logs effacés')
    }

    const getLogColor = (level) => {
        switch (level) {
            case 'error': return 'text-red-400'
            case 'warn': return 'text-yellow-400'
            case 'info': return 'text-blue-400'
            case 'debug': return 'text-gray-500'
            default: return 'text-gray-400'
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[60vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <ServerIcon className="w-6 h-6 text-blue-500" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Status Backend</h2>
                            <p className="text-xs text-gray-400">
                                Version {backendStatus?.version || '...'} • {simulatorStatus?.isMockDevice ? 'Mode Simulateur' : 'Mode CU Bluetooth'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-800">
                    {/* Backend Status */}
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${backendStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm font-medium text-white">Backend</span>
                        </div>
                        <div className="text-xs text-gray-400">
                            {backendStatus ? 'Connecté' : 'Déconnecté'}
                        </div>
                    </div>

                    {/* CU/Simulator Status */}
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <BoltIcon className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium text-white">
                                {simulatorStatus?.isMockDevice ? 'Simulateur' : 'Control Unit'}
                            </span>
                        </div>
                        <div className="text-xs text-gray-400">
                            {simulatorStatus?.isMockDevice ? (
                                simulatorStatus.running ? 'En cours' : 'Arrêté'
                            ) : (
                                cuStatus?.connected ? 'Connecté' : 'Déconnecté'
                            )}
                        </div>
                    </div>

                    {/* WebSocket Status */}
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            {socketRef.current?.connected ? (
                                <SignalIcon className="w-4 h-4 text-green-500" />
                            ) : (
                                <SignalSlashIcon className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium text-white">WebSocket</span>
                        </div>
                        <div className="text-xs text-gray-400">
                            {socketRef.current?.connected ? 'Connecté' : 'Déconnecté'}
                        </div>
                    </div>
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                        <span className="text-sm font-medium text-gray-400">Logs ({filteredLogs.length})</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setGroupByType(!groupByType)}
                                className={`px-2 py-1 text-xs rounded ${groupByType ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                            >
                                {groupByType ? 'Groupé' : 'Chrono'}
                            </button>
                            {!groupByType && (
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
                                >
                                    <option value="all">All</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warn</option>
                                    <option value="error">Error</option>
                                    <option value="debug">Debug</option>
                                </select>
                            )}
                            <button
                                onClick={clearLogs}
                                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                                title="Effacer"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div
                        ref={logsContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-auto bg-gray-950 p-3 font-mono text-xs"
                    >
                        {loading ? (
                            <div className="text-gray-500 text-center py-4">Chargement...</div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="text-gray-500 text-center py-4">Aucun log</div>
                        ) : groupByType ? (
                            // Grouped view by type
                            <div className="space-y-4">
                                {LOG_TYPES.map(level => {
                                    const typeLogs = groupedLogs[level] || []
                                    if (typeLogs.length === 0) return null
                                    return (
                                        <div key={level}>
                                            <div className={`sticky top-0 py-1 px-2 rounded font-bold uppercase text-xs mb-1 ${getLogColor(level)} bg-gray-800`}>
                                                {level} ({typeLogs.length})
                                            </div>
                                            <div className="space-y-0.5 pl-2 border-l-2 border-gray-700">
                                                {typeLogs.map((log, i) => (
                                                    <div key={i} className="flex gap-2 py-0.5">
                                                        <span className="text-gray-600 flex-shrink-0">{log.timestamp}</span>
                                                        <span className="text-gray-300">{log.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            // Chronological view
                            filteredLogs.map((log, idx) => (
                                <div key={idx} className="flex gap-2 py-0.5">
                                    <span className="text-gray-600 flex-shrink-0">{log.timestamp}</span>
                                    <span className={`flex-shrink-0 uppercase w-12 ${getLogColor(log.level)}`}>
                                        [{log.level}]
                                    </span>
                                    <span className="text-gray-300">{log.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    )
}
