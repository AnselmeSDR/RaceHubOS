import i18n from '@/i18n'
import { cuStateLabel } from '../layout/cuState'

export const LOG_LEVELS = ['info', 'warn', 'error', 'debug']

/** The server events the status sheet logs, its own connection included. */
export const STATUS_EVENTS = [
  'connect',
  'disconnect',
  'cu:connected',
  'cu:disconnected',
  'cu:status',
  'cu:timer',
  'lap:completed',
  'session:started',
  'session:stopped',
]

const shortId = (id) => id.substring(0, 8)

/** A log line stamped with the time of day. */
export const logLine = (level, message) => ({
  timestamp: new Date().toLocaleTimeString(i18n.language, { hour12: false }),
  level,
  message,
})

/** `[level, message]` for a server event (`t` of the layout namespace). */
export function socketLog(t, event, data) {
  switch (event) {
    case 'connect':
      return ['info', t('statusPopup.logs.wsConnected')]
    case 'disconnect':
      return ['warn', t('statusPopup.logs.wsDisconnected')]
    case 'cu:connected':
      return ['info', t('statusPopup.logs.cuConnected')]
    case 'cu:disconnected':
      return ['warn', t('statusPopup.logs.cuDisconnected')]
    case 'cu:status':
      return ['debug', t('statusPopup.logs.cuStatus', { state: cuStateLabel(t, data.start), mode: data.mode })]
    case 'cu:timer': {
      const kind = data.isFinishLine
        ? t('statusPopup.logs.timerFinish')
        : t('statusPopup.logs.timerSector', { sector: data.sector })
      return ['debug', t('statusPopup.logs.timer', { kind, controller: data.controller, lapTime: data.lapTime })]
    }
    case 'lap:completed': {
      const label = data.driver?.name || `Ctrl ${data.controller}`
      return ['info', t('statusPopup.logs.lap', { label, time: (data.lapTime / 1000).toFixed(3) })]
    }
    case 'session:started':
      return ['info', t('statusPopup.logs.sessionStarted', { id: shortId(data.sessionId) })]
    default:
      return ['info', t('statusPopup.logs.sessionStopped', { id: shortId(data.sessionId) })]
  }
}

/** `[level, message]` lines for the server, simulator and Control Unit states just read. */
export function statusLogs(t, { health, bluetooth, simulator }) {
  const backend = ['info', t('statusPopup.logs.backendStatus', { status: health.status, version: health.version })]
  if (simulator.isMockDevice) {
    const state = simulator.running ? t('glossary:status.running') : t('glossary:status.stopped')
    return [backend, ['info', t('statusPopup.logs.simulatorMode', { state })]]
  }
  if (bluetooth.connected) return [backend, ['info', t('statusPopup.logs.cuConnected')]]
  return [backend, ['warn', t('statusPopup.logs.cuNotConnected')]]
}

const connection = (t, connected) => (connected ? t('glossary:status.connected') : t('glossary:status.disconnected'))

/** The server, the device (simulator or Control Unit) and the socket: each one's name, state and detail. */
export function statusItems(t, { health, bluetooth, simulator, socketConnected }) {
  const mock = simulator?.isMockDevice
  return [
    {
      id: 'backend',
      label: t('statusPopup.status.backend'),
      ok: !!health,
      detail: health ? `v${health.version}` : t('glossary:status.disconnected'),
    },
    {
      id: 'device',
      label: mock ? t('glossary:simulator') : t('glossary:system.controlUnit'),
      ok: !!(mock ? simulator.running : bluetooth?.connected),
      detail: mock
        ? simulator.running
          ? t('glossary:status.running')
          : t('glossary:status.stopped')
        : connection(t, bluetooth?.connected),
    },
    {
      id: 'socket',
      label: t('glossary:system.websocket'),
      ok: socketConnected,
      detail: connection(t, socketConnected),
    },
  ]
}
