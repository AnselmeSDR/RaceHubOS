import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useServerSocket } from '@/hooks/useServerSocket'
import { fetchBackendStatus } from './backendStatusApi'
import { logLine, socketLog, STATUS_EVENTS, statusLogs } from './statusLog'

/** An update adding `lines` (`[level, message]`), stamped now, to the log. */
function appending(lines) {
  const stamped = lines.map(([level, message]) => logLine(level, message))
  return (logs) => [...logs, ...stamped]
}

/**
 * While `isOpen`: the server, device and socket states, read on each opening, and a log of what
 * happens meanwhile, kept between openings.
 */
export function useBackendStatus(isOpen) {
  const { t } = useTranslation('layout')
  const [status, setStatus] = useState({ health: null, bluetooth: null, simulator: null })
  const [loading, setLoading] = useState(true)
  const [socketConnected, setSocketConnected] = useState(false)
  const [logs, setLogs] = useState([])
  const [wasOpen, setWasOpen] = useState(isOpen)

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) setLoading(true)
    else setSocketConnected(false)
  }

  useEffect(() => {
    if (!isOpen) return
    let current = true
    fetchBackendStatus()
      .then((read) => {
        if (!current) return
        setStatus(read)
        setLogs(appending(statusLogs(t, read)))
      })
      .catch((error) => {
        if (!current) return
        setStatus((s) => ({ ...s, health: null }))
        setLogs(appending([['error', t('statusPopup.logs.backendError', { message: error.message })]]))
      })
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [isOpen, t])

  useServerSocket(
    STATUS_EVENTS,
    (event, data) => {
      if (event === 'connect') setSocketConnected(true)
      if (event === 'disconnect') setSocketConnected(false)
      setLogs(appending([socketLog(t, event, data)]))
    },
    isOpen
  )

  const clearLogs = () => setLogs([logLine('info', t('statusPopup.logsCleared'))])

  return { ...status, loading, socketConnected, logs, clearLogs }
}
