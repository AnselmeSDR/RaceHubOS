import { useState, useCallback, useEffect, useMemo } from 'react'
import { Trophy, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Clock, Flag, RefreshCw, Check, X, Users, Zap, UserPlus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const API_URL = import.meta.env.VITE_API_URL || ''

const SESSION_TYPES = {
  qualif: { label: 'Qualification', shortLabel: 'Q', color: 'bg-blue-500/15 text-blue-600', icon: Clock },
  race: { label: 'Course', shortLabel: 'R', color: 'bg-green-500/15 text-green-600', icon: Flag }
}

export default function ChampionshipConfigModal({
  championship,
  sessions = [],
  tracks = [],
  drivers: allDrivers = [],
  open,
  onClose,
  onSave,
  onFinish,
  onSessionsChange
}) {
  const [name, setName] = useState(championship?.name || '')
  const [trackId, setTrackId] = useState(championship?.trackId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && championship) {
      setName(championship.name || '')
      setTrackId(championship.trackId || '')
    }
  }, [open, championship])

  const [editingSession, setEditingSession] = useState(null)
  const [sessionForm, setSessionForm] = useState({})
  const [showNewSession, setShowNewSession] = useState(null)
  const [newSessionForm, setNewSessionForm] = useState({ name: '', duration: 5, maxLaps: 10, useTime: true, useLaps: false })

  const isAuto = championship?.mode === 'auto'
  const [addingDriver, setAddingDriver] = useState('')

  // For auto mode: check what's editable
  const hasStartedQualif = sessions.some(s => s.type === 'qualif' && s.status !== 'draft')
  const participantIds = useMemo(() => new Set((championship?.participants || []).map(p => p.driverId)), [championship?.participants])
  const availableDrivers = useMemo(() => allDrivers.filter(d => !participantIds.has(d.id)), [allDrivers, participantIds])

  const handleAddParticipant = async (driverId) => {
    if (!driverId) return
    try {
      const currentParticipants = (championship?.participants || []).map(p => ({ driverId: p.driverId }))
      currentParticipants.push({ driverId })
      await fetch(`${API_URL}/api/championships/${championship.id}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: currentParticipants }),
      })
      setAddingDriver('')
      onSessionsChange?.()
    } catch (err) { setError(err.message) }
  }

  const handleRemoveParticipant = async (driverId) => {
    try {
      const currentParticipants = (championship?.participants || [])
        .filter(p => p.driverId !== driverId)
        .map(p => ({ driverId: p.driverId }))
      await fetch(`${API_URL}/api/championships/${championship.id}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: currentParticipants }),
      })
      onSessionsChange?.()
    } catch (err) { setError(err.message) }
  }

  const qrSessions = sessions
    .filter(s => s.type === 'qualif' || s.type === 'race')
    .sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || (new Date(a.createdAt) - new Date(b.createdAt)))

  const getSessionLabel = (session) => {
    const prefix = session.type === 'qualif' ? 'Q' : 'R'
    const sameType = qrSessions.filter(s => s.type === session.type)
    return `${prefix}${sameType.findIndex(s => s.id === session.id) + 1}`
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom est requis'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/championships/${championship.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), trackId: trackId || null })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur') }
      const data = await res.json()
      onSave(data.data)
      onClose()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleCreateSession = async () => {
    if (!showNewSession) return
    try {
      const res = await fetch(`${API_URL}/api/championships/${championship.id}/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: showNewSession,
          name: newSessionForm.name || undefined,
          maxDuration: newSessionForm.useTime ? newSessionForm.duration * 60000 : null,
          maxLaps: newSessionForm.useLaps ? newSessionForm.maxLaps : null,
          order: qrSessions.length
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur') }
      setShowNewSession(null)
      setNewSessionForm({ name: '', duration: 5, maxLaps: 10, useTime: true, useLaps: false })
      onSessionsChange?.()
    } catch (err) { setError(err.message) }
  }

  const handleDeleteSession = async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })
      onSessionsChange?.()
    } catch (err) { setError(err.message) }
  }

  const handleUpdateSession = async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionForm.name || null,
          maxDuration: sessionForm.useTime ? sessionForm.duration * 60000 : null,
          maxLaps: sessionForm.useLaps ? sessionForm.maxLaps : null
        })
      })
      setEditingSession(null)
      onSessionsChange?.()
    } catch (err) { setError(err.message) }
  }

  const handleMoveSession = async (sessionId, direction) => {
    const index = qrSessions.findIndex(s => s.id === sessionId)
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= qrSessions.length) return
    try {
      await Promise.all([
        fetch(`${API_URL}/api/sessions/${qrSessions[index].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: newIndex }) }),
        fetch(`${API_URL}/api/sessions/${qrSessions[newIndex].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: index }) }),
      ])
      onSessionsChange?.()
    } catch (err) { setError(err.message) }
  }

  const startEditing = (session) => {
    setEditingSession(session.id)
    setSessionForm({
      name: session.name || '',
      duration: session.maxDuration ? Math.round(session.maxDuration / 60000) : 5,
      maxLaps: session.maxLaps || 10,
      useTime: !!session.maxDuration,
      useLaps: !!session.maxLaps
    })
  }

  function SessionFormFields({ form, setForm, compact }) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={form.useTime} onChange={(e) => setForm(f => ({ ...f, useTime: e.target.checked }))} className="accent-blue-500" />
          <Clock className="size-3.5 text-muted-foreground" />
          <Input type="number" value={form.duration} onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 1 }))} disabled={!form.useTime} className="w-14 h-7 text-center" />
          <span className="text-xs text-muted-foreground">min</span>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={form.useLaps} onChange={(e) => setForm(f => ({ ...f, useLaps: e.target.checked }))} className="accent-green-500" />
          <RefreshCw className="size-3.5 text-muted-foreground" />
          <Input type="number" value={form.maxLaps} onChange={(e) => setForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 1 }))} disabled={!form.useLaps} className="w-14 h-7 text-center" />
          <span className="text-xs text-muted-foreground">tours</span>
        </label>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-yellow-500" />
            Configuration Championnat
          </SheetTitle>
          <SheetDescription>{championship?.name}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 space-y-4 pb-4">
          {error && (
            <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">{error}</div>
          )}

          {/* Championship info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Circuit</label>
              <Select value={trackId || '_none'} onValueChange={(v) => setTrackId(v === '_none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un circuit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">-- Sélectionner --</SelectItem>
                  {tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto mode: participants */}
          {isAuto && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Participants ({championship.participants?.length || 0})</span>
              </div>
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {(championship.participants || []).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
                    {p.driver?.img && <img src={`${API_URL}${p.driver.img}`} className="w-5 h-5 rounded-full object-cover" alt="" />}
                    <span className="font-medium flex-1 truncate">{p.driver?.name}</span>
                    {!hasStartedQualif && (
                      <button onClick={() => handleRemoveParticipant(p.driverId)} className="p-0.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10">
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
                {/* Add participant row */}
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <UserPlus className="size-3.5 text-muted-foreground" />
                  <select
                    value={addingDriver}
                    onChange={e => { handleAddParticipant(e.target.value); }}
                    className="flex-1 h-6 text-xs bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-ring rounded"
                  >
                    <option value="">Ajouter un pilote...</option>
                    {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Sessions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Sessions</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setShowNewSession('qualif')} className="text-blue-500 h-7">
                  <Plus className="size-3" /> Qualif
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowNewSession('race')} className="text-green-500 h-7">
                  <Plus className="size-3" /> Course
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border">
              {qrSessions.length === 0 && !showNewSession && (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Aucune session. Ajoutez une qualification ou une course.
                </div>
              )}

              {qrSessions.map((session, index) => {
                const config = SESSION_TYPES[session.type]
                const Icon = config.icon
                const isEditing = editingSession === session.id

                return (
                  <div key={session.id} className="p-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>{getSessionLabel(session)}</Badge>
                          <Input value={sessionForm.name} onChange={(e) => setSessionForm(f => ({ ...f, name: e.target.value }))} placeholder={config.label} className="flex-1 h-7" />
                          <Button size="sm" className="h-7" onClick={() => handleUpdateSession(session.id)}>
                            <Check className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingSession(null)}>
                            <X className="size-3.5" />
                          </Button>
                        </div>
                        <SessionFormFields form={sessionForm} setForm={setSessionForm} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {session.status === 'draft' && (
                          <div className="flex flex-col">
                            <button onClick={() => handleMoveSession(session.id, 'up')} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20">
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button onClick={() => handleMoveSession(session.id, 'down')} disabled={index === qrSessions.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20">
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                        )}

                        <Badge className={config.color}>{getSessionLabel(session)}</Badge>
                        <Icon className="size-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm flex-1">{session.name || config.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {session.maxDuration ? `${Math.round(session.maxDuration / 60000)}min` : ''}
                          {session.maxDuration && session.maxLaps ? ' / ' : ''}
                          {session.maxLaps ? `${session.maxLaps}t` : ''}
                        </span>
                        {session.status !== 'draft' && (
                          <Badge variant="outline" className="text-[10px]">{{ active: 'En cours', paused: 'En pause', finishing: 'Finition', finished: 'Terminé' }[session.status] || session.status}</Badge>
                        )}
                        {session.status === 'draft' && (
                          <>
                            <button onClick={() => startEditing(session)} className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => handleDeleteSession(session.id)} className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10">
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {showNewSession && (
                <div className="p-3 bg-muted/50">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={SESSION_TYPES[showNewSession].color}>
                        {showNewSession === 'qualif' ? 'Q' : 'R'}{qrSessions.filter(s => s.type === showNewSession).length + 1}
                      </Badge>
                      <Input value={newSessionForm.name} onChange={(e) => setNewSessionForm(f => ({ ...f, name: e.target.value }))} placeholder={SESSION_TYPES[showNewSession].label} className="flex-1 h-7" />
                      <Button size="sm" className="h-7" onClick={handleCreateSession} disabled={!newSessionForm.useTime && !newSessionForm.useLaps}>
                        <Check className="size-3.5" /> Créer
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowNewSession(null)}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    <SessionFormFields form={newSessionForm} setForm={setNewSessionForm} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          {championship?.status !== 'finished' && onFinish ? (
            <Button variant="destructive" size="sm" onClick={() => { onFinish(); onClose() }}>
              <Flag className="size-3.5" />
              Terminer le championnat
            </Button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Fermer</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
