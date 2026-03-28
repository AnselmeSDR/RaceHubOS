import { useState, useMemo } from 'react'
import { Settings, Play, Pause, Square, Clock, RefreshCw, Flag, FlaskConical, AlertTriangle, Trash2, Copy, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StartLights } from '../ui'
import { useDevice } from '../../context/DeviceContext'
import { useSession } from '../../context/SessionContext'

const SESSION_TYPE_LABELS = {
  practice: 'Essais Libres',
  qualif: 'Qualifications',
  race: 'Course'
}

const SESSION_TYPE_ICONS = {
  practice: FlaskConical,
  qualif: Clock,
  race: Flag
}

const CONTROLLER_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'
]

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

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [maxLaps, setMaxLapsState] = useState(0)
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(30)
  const [status, setStatus] = useState('draft')
  const [controllerConfigs, setControllerConfigs] = useState({})
  const [saving, setSaving] = useState(false)

  const gracePeriodTotal = finishingSession?.gracePeriodMs ? finishingSession.gracePeriodMs / 1000 : 30

  function startEditing() {
    setName(session?.name || '')
    setDurationMinutes(session?.maxDuration ? Math.round(session.maxDuration / 60000) : 0)
    setMaxLapsState(session?.maxLaps || 0)
    setGracePeriodSeconds(session?.gracePeriod ? Math.round(session.gracePeriod / 1000) : 30)
    setStatus(session?.status || 'draft')
    const configs = {}
    for (let i = 0; i < 6; i++) {
      const sd = (session?.drivers || []).find(d => Number(d.controller) === i)
      configs[i] = { driverId: sd?.driverId || null, carId: sd?.carId || null, gridPos: sd?.gridPos || null }
    }
    setControllerConfigs(configs)
    setEditing(true)
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

  const handleControllerChange = (controller, field, value) => {
    setControllerConfigs(prev => ({ ...prev, [controller]: { ...prev[controller], [field]: value || null } }))
  }

  const incompleteControllers = useMemo(() => {
    return Object.entries(controllerConfigs)
      .filter(([, c]) => (c.driverId && !c.carId) || (!c.driverId && c.carId))
      .map(([ctrl, c]) => ({ controller: Number(ctrl), hasDriver: !!c.driverId, hasCar: !!c.carId }))
  }, [controllerConfigs])
  const hasIncompleteConfig = incompleteControllers.length > 0
  const canSetReady = !hasIncompleteConfig

  const practiceSession = useMemo(() => {
    if (session?.type === 'practice' || !session?.championshipId) return null
    return sessions.find(s => s.type === 'practice' && s.drivers?.length > 0)
  }, [sessions, session])

  const handleCopyFromPractice = () => {
    if (!practiceSession?.drivers) return
    const newConfigs = {}
    for (let i = 0; i < 6; i++) {
      const sd = practiceSession.drivers.find(d => Number(d.controller) === i)
      newConfigs[i] = { driverId: sd?.driverId || null, carId: sd?.carId || null, gridPos: sd?.gridPos || null }
    }
    setControllerConfigs(newConfigs)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const driversPayload = Object.entries(controllerConfigs)
        .filter(([, c]) => c.driverId || c.carId)
        .map(([ctrl, c]) => ({ controller: Number(ctrl), driverId: c.driverId || null, carId: c.carId || null, gridPos: c.gridPos || null }))
      const finalStatus = hasIncompleteConfig && status === 'ready' ? 'draft' : status
      await onSaveConfig({
        name: name || null,
        maxDuration: durationMinutes > 0 ? durationMinutes * 60000 : null,
        maxLaps: maxLaps > 0 ? maxLaps : null,
        gracePeriod: gracePeriodSeconds > 0 ? gracePeriodSeconds * 1000 : 30000,
        status: finalStatus,
        drivers: driversPayload,
      })
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
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

  const hasProgress = timeProgress || lapsProgress || (session?.status === 'finishing' && gracePeriodRemaining !== null)

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
      case 'ready': return { label: 'Prêt', color: 'bg-blue-100 text-blue-700' }
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
  const canStart = session.status === 'ready'
  const isLights = isActive && cuStatus?.start >= 1 && cuStatus?.start <= 5
  const isRacing = isActive && cuStatus?.start === 0
  const isCuStopped = isActive && cuStatus?.start >= 8
  const canPause = isRacing && socketConnected
  const canResumeFromPause = isPaused && socketConnected
  const canResumeCu = isCuStopped && socketConnected
  const canStop = (isRacing || isPaused) && socketConnected
  const canEdit = ['draft', 'ready'].includes(session.status)
  const showControllers = canEdit && !editing

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TypeIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">
            {sessionLabel} - {session.name || SESSION_TYPE_LABELS[session.type]}
          </h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''}`}>
            {statusConfig.label}
          </span>
        </div>

        {canEdit && !editing && (
          <button onClick={startEditing} className="p-1.5 hover:bg-muted rounded transition-colors" title="Configurer">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Check className="size-4" />
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Inline config form */}
      {editing && (
        <div className="p-4 border-b border-border space-y-4">
          {/* Name + settings */}
          <div className={`grid gap-3 ${session.type === 'practice' ? 'grid-cols-1' : 'grid-cols-4'}`}>
            <div className={session.type === 'practice' ? '' : 'col-span-1'}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={SESSION_TYPE_LABELS[session.type]} />
            </div>
            {session.type !== 'practice' && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Durée (min)</label>
                  <Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)} min="0" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Max tours</label>
                  <Input type="number" value={maxLaps} onChange={(e) => setMaxLapsState(parseInt(e.target.value) || 0)} min="0" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Grace (sec)</label>
                  <Input type="number" value={gracePeriodSeconds} onChange={(e) => setGracePeriodSeconds(parseInt(e.target.value) || 30)} min="5" max="300" />
                </div>
              </>
            )}
          </div>

          {/* Controllers config */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Controllers</span>
              {practiceSession && (
                <button onClick={handleCopyFromPractice} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
                  <Copy className="size-3" /> Copier depuis EL
                </button>
              )}
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase bg-muted/50">
                    <th className="px-3 py-1.5 font-medium w-12">Ctrl</th>
                    <th className="px-3 py-1.5 font-medium">Pilote</th>
                    <th className="px-3 py-1.5 font-medium">Voiture</th>
                    <th className="px-3 py-1.5 font-medium w-16">Grille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[0, 1, 2, 3, 4, 5].map(ctrl => (
                    <tr key={ctrl}>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center justify-center size-6 rounded-full text-white text-xs font-bold ${CONTROLLER_COLORS[ctrl]}`}>{ctrl + 1}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select value={controllerConfigs[ctrl]?.driverId || '_none'} onValueChange={(v) => handleControllerChange(ctrl, 'driverId', v === '_none' ? '' : v)}>
                          <SelectTrigger className="w-full h-7 text-xs">
                            <SelectValue placeholder="---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">---</SelectItem>
                            {getAvailableDrivers(ctrl).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select value={controllerConfigs[ctrl]?.carId || '_none'} onValueChange={(v) => handleControllerChange(ctrl, 'carId', v === '_none' ? '' : v)}>
                          <SelectTrigger className="w-full h-7 text-xs">
                            <SelectValue placeholder="---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">---</SelectItem>
                            {getAvailableCars(ctrl).map(c => <SelectItem key={c.id} value={c.id}>{c.brand} {c.model}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number" min="1" max="6"
                          value={controllerConfigs[ctrl]?.gridPos || ''}
                          onChange={(e) => handleControllerChange(ctrl, 'gridPos', e.target.value ? Number(e.target.value) : null)}
                          placeholder="-"
                          className="text-center h-7 w-16"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status + warnings */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" value="draft" checked={status === 'draft'} onChange={(e) => setStatus(e.target.value)} className="accent-yellow-500" />
                Brouillon
              </label>
              <label className={`flex items-center gap-2 text-sm ${canSetReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <input type="radio" value="ready" checked={status === 'ready'} onChange={(e) => canSetReady && setStatus(e.target.value)} disabled={!canSetReady} className="accent-blue-500" />
                Prêt
              </label>
            </div>
            <div className="flex items-center gap-1">
              {onReset && (
                <Button variant="ghost" size="sm" onClick={() => onReset(session.id)} className="text-orange-500">
                  <RefreshCw className="size-3.5" /> Reset
                </Button>
              )}
              {onDelete && session.type !== 'practice' && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(session.id)} className="text-destructive">
                  <Trash2 className="size-3.5" /> Supprimer
                </Button>
              )}
            </div>
          </div>

          {hasIncompleteConfig && (
            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-600">
                {incompleteControllers.map(ic => ic.hasDriver ? `Ctrl ${ic.controller + 1}: pilote sans voiture` : `Ctrl ${ic.controller + 1}: voiture sans pilote`).join(' · ')}
              </p>
            </div>
          )}
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

      {/* Read-only controller table (draft/ready, not editing) */}
      {showControllers && (
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs uppercase">
                <th className="pb-2 font-medium">Ctrl</th>
                <th className="pb-2 font-medium">Pilote</th>
                <th className="pb-2 font-medium">Voiture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[0, 1, 2, 3, 4, 5].map(controller => {
                const sd = sessionDrivers.find(d => Number(d.controller) === controller)
                return (
                  <tr key={controller} className="text-foreground">
                    <td className="py-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${CONTROLLER_COLORS[controller]}`}>{controller + 1}</span>
                    </td>
                    <td className="py-2">
                      {sd?.driver ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: sd.driver.color || '#6B7280' }}>{sd.driver.name?.charAt(0) || '?'}</span>
                          {sd.driver.name}
                        </span>
                      ) : <span className="text-muted-foreground/50">---</span>}
                    </td>
                    <td className="py-2">
                      {sd?.car ? <span>{sd.car.brand} {sd.car.model}</span> : <span className="text-muted-foreground/50">---</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
        <div className="flex items-center gap-2">
          {canStart && (
            <>
              {!deviceConnected && <span className="text-sm text-orange-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Connecter un CU</span>}
              <Button onClick={onStart} disabled={!deviceConnected}><Play className="size-4" /> Démarrer</Button>
            </>
          )}
          {isLights && <Button onClick={onTriggerCuStart} className="bg-green-500 hover:bg-green-600 animate-pulse"><Play className="size-4" /> START</Button>}
          {canResumeCu && <Button onClick={onTriggerCuStart} className="bg-orange-500 hover:bg-orange-600"><RefreshCw className="size-4" /> Reprendre CU</Button>}
          {canPause && <Button onClick={onPause} variant="outline" className="border-yellow-500 text-yellow-600"><Pause className="size-4" /> Pause</Button>}
          {canResumeFromPause && <Button onClick={onResume} className="bg-green-500 hover:bg-green-600"><Play className="size-4" /> Reprendre</Button>}
          {canStop && <Button onClick={onStop} variant="destructive"><Flag className="size-4" /> Terminer</Button>}
          {isFinishing && <span className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg"><Flag className="w-4 h-4" /> Attente fin...</span>}
          {isFinished && <span className="text-sm text-muted-foreground">Session terminée</span>}
        </div>
      </div>

      {isActive && <StartLights />}
    </div>
  )
}
