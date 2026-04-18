import { useState, useMemo, useRef } from 'react'
import { Play, Pause, Square, Clock, RefreshCw, Flag, FlaskConical, Scale, AlertTriangle, Trash2, Copy, Trophy, Timer } from 'lucide-react'
import Podium from '../race/Podium'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StartLights } from '../ui'
import { useDevice } from '../../context/DeviceContext'
import { useSession } from '../../context/SessionContext'

const SESSION_TYPE_LABELS = {
  practice: 'Essais Libres',
  qualif: 'Qualifications',
  race: 'Course',
  balancing: 'Équilibrage'
}

const SESSION_TYPE_ICONS = {
  practice: FlaskConical,
  qualif: Clock,
  race: Flag,
  balancing: Scale
}

import { CONTROLLER_COLORS } from '../../lib/colors'

export default function SessionSection({
  session,
  sessions = [],
  drivers = [],
  cars = [],
  onStart,
  onPause,
  onResume,
  onStop,
  onTriggerCuStart,
  onSaveConfig,
  onDelete,
  onReset,
  maxLapTime,
  onMaxLapTimeChange,
  autoMode = false,
}) {
  const { cuStatus, socketConnected, connected: deviceConnected } = useDevice()
  const {
    elapsed: elapsedTime,
    maxLapsCompleted,
    gracePeriodRemaining,
    pauseDuration,
    totalPauseDuration,
    pauses,
    startedAt,
    finishingSession,
  } = useSession()

  const [starting, setStarting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [inlineName, setInlineName] = useState('')
  const nameInputRef = useRef(null)

  const controllerConfigs = useMemo(() => {
    const configs = {}
    for (let i = 0; i < 6; i++) {
      const sd = (session?.drivers || []).find(d => Number(d.controller) === i)
      configs[i] = { driverId: sd?.driverId || null, carId: sd?.carId || null, gridPos: sd?.gridPos || null }
    }
    return configs
  }, [JSON.stringify(session?.drivers?.map(d => ({ id: d.id, controller: d.controller, driverId: d.driverId, carId: d.carId, gridPos: d.gridPos })))])

  const gracePeriodTotal = finishingSession?.gracePeriodMs ? finishingSession.gracePeriodMs / 1000 : 30

  function startEditingName() {
    if (!canEdit) return
    setInlineName(session?.name || '')
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  async function saveInlineName(text) {
    setEditingName(false)
    const value = typeof text === 'string' ? text : inlineName
    const newName = value.trim() || null
    if (newName === (session?.name || null)) return
    try {
      await onSaveConfig({ name: newName })
    } catch (err) {
      console.error('Failed to save name:', err)
    }
    // Reset contentEditable text to type label if empty
    if (!newName && nameInputRef.current) {
      nameInputRef.current.textContent = SESSION_TYPE_LABELS[session.type]
    }
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') nameInputRef.current?.blur()
    if (e.key === 'Escape') {
      setInlineName(session?.name || '')
      setEditingName(false)
    }
  }


  const usedDriverIds = useMemo(() => Object.values(controllerConfigs).map(c => c.driverId).filter(Boolean), [controllerConfigs])
  const usedCarIds = useMemo(() => Object.values(controllerConfigs).map(c => c.carId).filter(Boolean), [controllerConfigs])

  const getAvailableDrivers = (controller) => {
    const currentId = controllerConfigs[controller]?.driverId
    return drivers.filter(d => d.id === currentId || !usedDriverIds.includes(d.id))
  }
  const getAvailableCars = (controller) => {
    const currentId = controllerConfigs[controller]?.carId
    return cars.filter(c => c.id === currentId || !usedCarIds.includes(c.id))
  }

  const handleControllerChange = async (controller, field, value) => {
    const updated = { ...controllerConfigs, [controller]: { ...controllerConfigs[controller], [field]: value || null } }
    const driversPayload = Object.entries(updated)
      .filter(([, c]) => c.driverId || c.carId)
      .map(([ctrl, c]) => ({ controller: Number(ctrl), driverId: c.driverId || null, carId: c.carId || null, gridPos: c.gridPos || null }))
    try {
      await onSaveConfig({ drivers: driversPayload })
    } catch (err) {
      console.error('Failed to save controller config:', err)
    }
  }

  const incompleteControllers = useMemo(() => {
    return Object.entries(controllerConfigs)
      .filter(([, c]) => {
        if (session?.type === 'balancing') return false
        return (c.driverId && !c.carId) || (!c.driverId && c.carId)
      })
      .map(([ctrl, c]) => ({ controller: Number(ctrl), hasDriver: !!c.driverId, hasCar: !!c.carId }))
  }, [controllerConfigs, session?.type])
  const hasIncompleteConfig = incompleteControllers.length > 0

  const practiceSession = useMemo(() => {
    if (session?.type === 'practice' || !session?.championshipId) return null
    return sessions.find(s => s.type === 'practice' && s.drivers?.length > 0)
  }, [sessions, session])

  const handleCopyFromPractice = async () => {
    if (!practiceSession?.drivers) return
    const driversPayload = []
    for (let i = 0; i < 6; i++) {
      const sd = practiceSession.drivers.find(d => Number(d.controller) === i)
      if (sd?.driverId || sd?.carId) {
        driversPayload.push({ controller: i, driverId: sd?.driverId || null, carId: sd?.carId || null, gridPos: sd?.gridPos || null })
      }
    }
    try {
      await onSaveConfig({ drivers: driversPayload })
    } catch (err) {
      console.error('Failed to copy from practice:', err)
    }
  }

  // Timeline segments
  const timelineSegments = useMemo(() => {
    if (!startedAt) return []
    const startTime = new Date(startedAt).getTime()
    const endTime = session?.finishedAt ? new Date(session.finishedAt).getTime() : Date.now()
    const segments = []
    let lastEnd = startTime
    const sortedPauses = [...(pauses || [])].sort((a, b) => a.start - b.start)
    for (const pause of sortedPauses) {
      if (pause.start > lastEnd) segments.push({ type: 'active', duration: pause.start - lastEnd })
      segments.push({ type: 'pause', duration: (pause.end || endTime) - pause.start })
      lastEnd = pause.end || endTime
    }
    const lastPause = sortedPauses[sortedPauses.length - 1]
    if (!lastPause || lastPause.end) {
      const d = endTime - lastEnd
      if (d > 0) segments.push({ type: 'active', duration: d })
    }
    return segments
  }, [startedAt, pauses, session?.finishedAt])

  const totalWallTime = useMemo(() => timelineSegments.reduce((s, seg) => s + seg.duration, 0), [timelineSegments])

  const sessionLabel = useMemo(() => {
    if (!session) return ''
    if (session.type === 'practice') return 'EL'
    const sameType = sessions.filter(s => s.type === session.type).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const index = sameType.findIndex(s => s.id === session.id) + 1
    return `${session.type === 'qualif' ? 'Q' : 'R'}${index}`
  }, [session, sessions])

  const timeProgress = useMemo(() => {
    if (!session) return null
    let currentElapsed = elapsedTime
    if (session.status === 'finished' && session.startedAt && session.finishedAt)
      currentElapsed = (new Date(session.finishedAt) - new Date(session.startedAt)) / 1000
    const isRunning = ['active', 'paused', 'finishing'].includes(session.status)
    if (!session.maxDuration || session.maxDuration <= 0) {
      if ((isRunning && currentElapsed >= 0) || (session.status === 'finished' && currentElapsed > 0))
        return { type: 'time', current: currentElapsed, pauseTime: totalPauseDuration, total: null, remaining: null, isComplete: session.status === 'finished' }
      return null
    }
    const totalSeconds = session.maxDuration / 1000
    return { type: 'time', current: currentElapsed, pauseTime: totalPauseDuration, total: totalSeconds, remaining: Math.max(totalSeconds - currentElapsed, 0), isComplete: currentElapsed >= totalSeconds }
  }, [session, elapsedTime, totalPauseDuration])

  const lapsProgress = useMemo(() => {
    if (!session) return null
    let currentLaps = maxLapsCompleted
    if (session.status === 'finished' && session.drivers?.length > 0)
      currentLaps = Math.max(...session.drivers.map(d => d.totalLaps || 0))
    const isRunning = ['active', 'paused', 'finishing'].includes(session.status)
    if (!session.maxLaps || session.maxLaps <= 0) {
      if ((isRunning && currentLaps >= 0) || (session.status === 'finished' && currentLaps > 0))
        return { type: 'laps', percentage: session.status === 'finished' ? 100 : 0, current: currentLaps, total: null, remaining: null, isComplete: session.status === 'finished' }
      return null
    }
    const percentage = Math.min((currentLaps / session.maxLaps) * 100, 100)
    return { type: 'laps', percentage, current: currentLaps, total: session.maxLaps, remaining: Math.max(session.maxLaps - currentLaps, 0), isComplete: currentLaps >= session.maxLaps }
  }, [session, maxLapsCompleted])

  const hasProgress = session?.status !== 'finished' && (timeProgress || lapsProgress || (session?.status === 'finishing' && gracePeriodRemaining !== null))

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const sessionDrivers = useMemo(() => {
    if (!session?.drivers) return []
    return session.drivers.map(sd => ({ ...sd, driver: drivers.find(d => d.id === sd.driverId), car: cars.find(c => c.id === sd.carId) }))
  }, [session, drivers, cars])

  const getStatusConfig = (st) => {
    switch (st) {
      case 'active': return { label: 'En cours', color: 'bg-green-100 text-green-700', pulse: true }
      case 'paused': return { label: 'En pause', color: 'bg-yellow-100 text-yellow-700' }
      case 'finishing': return { label: 'Fin de session...', color: 'bg-orange-100 text-orange-700', pulse: true }
      case 'finished': return { label: 'Terminé', color: 'bg-muted text-muted-foreground' }
      default: return { label: 'Brouillon', color: 'bg-yellow-100 text-yellow-700' }
    }
  }

  if (!session) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
        <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
        Sélectionnez une session
      </div>
    )
  }

  const TypeIcon = SESSION_TYPE_ICONS[session.type] || Flag
  const statusConfig = getStatusConfig(session.status)
  const isActive = session.status === 'active'
  const isPaused = session.status === 'paused'
  const isFinishing = session.status === 'finishing'
  const isFinished = session.status === 'finished'
  const canStart = session.status === 'draft'
  const isLights = isActive && cuStatus?.start >= 1 && cuStatus?.start <= 5
  const isRacing = isActive && cuStatus?.start === 0
  const isCuStopped = isActive && cuStatus?.start >= 8
  const canPause = isRacing && socketConnected
  const canResumeFromPause = isPaused && socketConnected
  const canResumeCu = isCuStopped && socketConnected
  const canStop = (isRacing || isPaused) && socketConnected
  const canEdit = session.status === 'draft'
  const isAutoSession = autoMode && session.type !== 'practice'

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TypeIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground flex items-center gap-1">
            {sessionLabel} -{' '}
            {editingName ? (
              <span
                ref={nameInputRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => saveInlineName(e.target.textContent)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
                  if (e.key === 'Escape') { e.target.textContent = session?.name || SESSION_TYPE_LABELS[session.type]; setEditingName(false) }
                }}
                className="outline-none cursor-text"
              >
                {inlineName || SESSION_TYPE_LABELS[session.type]}
              </span>
            ) : (
              <span
                onClick={startEditingName}
                className={canEdit ? 'cursor-text hover:text-muted-foreground transition-colors' : ''}
              >
                {session.name || SESSION_TYPE_LABELS[session.type]}
              </span>
            )}
          </h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''}`}>
            {statusConfig.label}
          </span>
        </div>

      </div>

      {/* Session config + Controllers table */}
      {canEdit && (
        <div className="p-4 border-b border-border space-y-3">
          {practiceSession && (
            <div className="flex justify-end">
              <button onClick={handleCopyFromPractice} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
                <Copy className="size-3" /> Copier depuis EL
              </button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs uppercase">
                <th className="pb-2 font-medium w-12">Ctrl</th>
                {session.type !== 'balancing' && <th className="pb-2 font-medium">Pilote</th>}
                <th className="pb-2 font-medium">Voiture</th>
                {session.type !== 'balancing' && <th className="pb-2 font-medium w-16">Grille</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[0, 1, 2, 3, 4, 5].map(ctrl => {
                const sd = sessionDrivers.find(d => Number(d.controller) === ctrl)
                return (
                  <tr key={ctrl} className="text-foreground">
                    <td className="py-2">
                      <span className={`inline-flex items-center justify-center size-6 rounded-full text-white text-xs font-bold ${CONTROLLER_COLORS[ctrl]}`}>{ctrl + 1}</span>
                    </td>
                    {session.type !== 'balancing' && (
                      <td className="py-2">
                        <Select value={controllerConfigs[ctrl]?.driverId || '_none'} onValueChange={(v) => handleControllerChange(ctrl, 'driverId', v === '_none' ? '' : v)}>
                          <SelectTrigger className="w-full h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors">
                            <SelectValue placeholder="---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">---</SelectItem>
                            {getAvailableDrivers(ctrl).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="py-2">
                      <Select value={controllerConfigs[ctrl]?.carId || '_none'} onValueChange={(v) => handleControllerChange(ctrl, 'carId', v === '_none' ? '' : v)}>
                        <SelectTrigger className="w-full h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors">
                          <SelectValue placeholder="---" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">---</SelectItem>
                          {getAvailableCars(ctrl).map(c => <SelectItem key={c.id} value={c.id}>{c.brand} {c.model}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    {session.type !== 'balancing' && (
                      <td className="py-2">
                        <Input
                          key={`grid-${ctrl}-${controllerConfigs[ctrl]?.gridPos}`}
                          type="number" min="1" max="6"
                          defaultValue={controllerConfigs[ctrl]?.gridPos || ''}
                          onBlur={(e) => handleControllerChange(ctrl, 'gridPos', e.target.value ? Number(e.target.value) : null)}
                          placeholder="-"
                          className="text-center h-7 w-16 border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors"
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {hasIncompleteConfig && (
            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-600">
                {incompleteControllers.map(ic => ic.hasDriver ? `Ctrl ${ic.controller + 1}: pilote sans voiture` : `Ctrl ${ic.controller + 1}: voiture sans pilote`).join(' · ')}
              </p>
            </div>
          )}
          {session.type !== 'practice' && (
            <div className={`grid gap-3 ${session.type === 'balancing' ? 'grid-cols-3' : 'grid-cols-3'}`}>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Durée (min)</label>
                <Input
                  key={`dur-${session.id}-${session.maxDuration}`}
                  type="number"
                  defaultValue={session.maxDuration ? Math.round(session.maxDuration / 60000) : 0}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value) || 0
                    onSaveConfig({ maxDuration: val > 0 ? val * 60000 : null })
                  }}
                  min="0"
                  placeholder="0 = illimité"
                  className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Max tours</label>
                <Input
                  key={`laps-${session.id}-${session.maxLaps}`}
                  type="number"
                  defaultValue={session.maxLaps || 0}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value) || 0
                    onSaveConfig({ maxLaps: val > 0 ? val : null })
                  }}
                  min="0"
                  placeholder="0 = illimité"
                  className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors"
                />
              </div>
              {session.type !== 'balancing' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Grace (sec)</label>
                  <Input
                    key={`grace-${session.id}-${session.gracePeriod}`}
                    type="number"
                    defaultValue={session.gracePeriod ? Math.round(session.gracePeriod / 1000) : 30}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 30
                      onSaveConfig({ gracePeriod: Math.max(5, Math.min(300, val)) * 1000 })
                    }}
                    min="5" max="300"
                    className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors"
                  />
                </div>
              )}
              {session.type === 'balancing' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Temps max (sec)</label>
                  <Input
                    key={`maxlap-${session.id}-${maxLapTime}`}
                    type="number"
                    step="0.1"
                    defaultValue={maxLapTime ? (maxLapTime / 1000).toFixed(1) : ''}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      onMaxLapTimeChange?.(val > 0 ? Math.round(val * 1000) : null)
                    }}
                    min="0"
                    placeholder="0 = pas de filtre"
                    className="h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Auto mode: read-only driver display */}
      {isAutoSession && !canEdit && sessionDrivers.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            {sessionDrivers.map(sd => (
              <div key={sd.id} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-full px-2.5 py-1">
                <span className={`inline-flex items-center justify-center size-4 rounded-full text-white text-[10px] font-bold ${CONTROLLER_COLORS[sd.controller]}`}>{sd.controller + 1}</span>
                {sd.driver?.img && <img src={`${import.meta.env.VITE_API_URL || ''}${sd.driver.img}`} className="w-4 h-4 rounded-full object-cover" alt="" />}
                <span className="font-medium">{sd.driver?.name || '?'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto mode: waiting for qualif results */}
      {isAutoSession && session.type === 'race' && sessionDrivers.length === 0 && (
        <div className="px-4 py-4 border-b border-border text-center">
          <p className="text-sm text-muted-foreground italic">
            Pilotes assignés automatiquement après les qualifications
          </p>
        </div>
      )}

      {/* Progress bars */}
      {hasProgress && (
        <div className="px-4 py-3 bg-muted/50 border-b border-border space-y-3">
          {timeProgress && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {formatTime(timeProgress.current)}
                  {timeProgress.pauseTime > 0 && <span className="text-yellow-600">(+{formatTime(timeProgress.pauseTime)} pause)</span>}
                  {timeProgress.total && ` / ${formatTime(timeProgress.total)}`}
                  {isFinished && timeProgress.total && timeProgress.current > timeProgress.total && <span className="text-orange-600 ml-1">(+{formatTime(timeProgress.current - timeProgress.total)})</span>}
                </span>
                {isActive && timeProgress.total && (
                  <span className={`font-bold ${timeProgress.isComplete ? 'text-red-600' : 'text-foreground'}`}>
                    {formatTime(timeProgress.remaining)} restant
                  </span>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                {timelineSegments.map((seg, i) => (
                  <div key={i} className={`h-full transition-all duration-300 ${seg.type === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${totalWallTime > 0 ? (seg.duration / totalWallTime) * 100 : 0}%` }} />
                ))}
              </div>
            </div>
          )}
          {lapsProgress && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <RefreshCw className="w-4 h-4" />
                  {lapsProgress.current} {lapsProgress.total ? `/ ${lapsProgress.total}` : ''} tours
                  {isFinished && lapsProgress.total && lapsProgress.current > lapsProgress.total && <span className="text-orange-600 ml-1">(+{lapsProgress.current - lapsProgress.total})</span>}
                </span>
                {isActive && lapsProgress.total && (
                  <span className={`font-bold ${lapsProgress.isComplete ? 'text-red-600' : 'text-foreground'}`}>
                    {lapsProgress.remaining} restants
                  </span>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                <div className={`h-full transition-all duration-500 ${lapsProgress.isComplete ? 'bg-green-500' : isActive || isPaused ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(lapsProgress.percentage, 100)}%` }} />
                {isFinished && lapsProgress.total && lapsProgress.current > lapsProgress.total && (
                  <div className="h-full bg-orange-400" style={{ width: `${Math.min(((lapsProgress.current - lapsProgress.total) / lapsProgress.total) * 100, 20)}%` }} />
                )}
              </div>
            </div>
          )}
          {isFinishing && gracePeriodRemaining !== null && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-orange-600 font-medium"><Flag className="w-4 h-4" /> Drapeau à damier</span>
                <span className="font-bold text-orange-700 animate-pulse">{formatTime(gracePeriodRemaining)}</span>
              </div>
              <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${Math.max(0, (gracePeriodRemaining / gracePeriodTotal) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}


      {/* Finished summary (skip for balancing) */}
      {isFinished && session.type !== 'balancing' && sessionDrivers.length > 0 && (
        <div className="border-b border-border">
          <Podium
            drivers={sessionDrivers}
            sessionType={session.type}
            stats={{
              duration: timeProgress?.current,
              maxDuration: session.maxDuration,
              maxLaps: session.maxLaps,
              gracePeriod: session.gracePeriod,
              gracePeriodUsed: !!session.finishingAt,
            }}
          />
        </div>
      )}

      {/* Connection warning */}
      {!socketConnected && isActive && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-500 font-medium text-sm">Connexion perdue - Reconnexion...</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 bg-muted/50 border-t border-border flex items-center justify-between gap-2">
        <div className="text-sm">
          {isLights && <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium animate-pulse">Feux {cuStatus.start}/5</span>}
          {isRacing && <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded font-medium">En course</span>}
          {isCuStopped && <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-700 rounded font-medium"><AlertTriangle className="w-4 h-4" /> CU arrêté</span>}
          {isPaused && <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">Pause {pauseDuration !== null && formatTime(pauseDuration)}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canStart && (
            <>
              {!deviceConnected && <span className="text-sm text-orange-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Connecter un CU</span>}
              {hasIncompleteConfig && <span className="text-sm text-orange-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Config incomplète</span>}
              <Button onClick={async () => { setStarting(true); try { await onStart() } finally { setStarting(false) } }} disabled={!deviceConnected || hasIncompleteConfig || starting}>
                {starting ? <><RefreshCw className="size-4 animate-spin" /> Démarrage...</> : <><Play className="size-4" /> Démarrer</>}
              </Button>
            </>
          )}
          {isLights && <Button onClick={onTriggerCuStart} className="bg-green-500 hover:bg-green-600 animate-pulse"><Play className="size-4" /> START</Button>}
          {canResumeCu && <Button onClick={onTriggerCuStart} className="bg-orange-500 hover:bg-orange-600"><RefreshCw className="size-4" /> Reprendre CU</Button>}
          {canPause && <Button onClick={onPause} variant="outline" className="border-yellow-500 text-yellow-600"><Pause className="size-4" /> Pause</Button>}
          {canResumeFromPause && <Button onClick={onResume} className="bg-green-500 hover:bg-green-600"><Play className="size-4" /> Reprendre</Button>}
          {canStop && <Button onClick={onStop} variant="destructive"><Flag className="size-4" /> Terminer</Button>}
          {isFinishing && <span className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg whitespace-nowrap flex-shrink-0"><Flag className="w-4 h-4" /> Attente fin de session</span>}
          {isFinished && onReset && (
            <Button variant="ghost" size="sm" onClick={() => onReset(session.id)} className="text-orange-500"><RefreshCw className="size-3.5" /> Reset</Button>
          )}
        </div>
      </div>

      {isActive && <StartLights onCancel={onReset ? () => onReset(session.id) : undefined} />}
    </div>
  )
}
