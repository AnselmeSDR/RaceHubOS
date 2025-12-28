import { useState, useCallback, useEffect } from 'react'
import {
  TrophyIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClockIcon,
  FlagIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import Modal, { ModalFooter, ModalButton } from '../ui/Modal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const SESSION_TYPES = {
  qualif: { label: 'Qualification', shortLabel: 'Q', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300', icon: ClockIcon },
  race: { label: 'Course', shortLabel: 'R', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300', icon: FlagIcon }
}

/**
 * ChampionshipConfigModal - Modal to configure a championship
 * Edit name, track, and manage sessions (CRUD + reorder)
 */
export default function ChampionshipConfigModal({
  championship,
  sessions = [],
  tracks = [],
  open,
  onClose,
  onSave,
  onSessionsChange
}) {
  const [name, setName] = useState(championship?.name || '')
  const [trackId, setTrackId] = useState(championship?.trackId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync state when championship changes or modal opens
  useEffect(() => {
    if (open && championship) {
      setName(championship.name || '')
      setTrackId(championship.trackId || '')
    }
  }, [open, championship])

  // Session being edited inline
  const [editingSession, setEditingSession] = useState(null)
  const [sessionForm, setSessionForm] = useState({})

  // New session form
  const [showNewSession, setShowNewSession] = useState(null) // 'qualif' or 'race'
  const [newSessionForm, setNewSessionForm] = useState({
    name: '',
    duration: 5,
    maxLaps: 10,
    useTime: true,
    useLaps: false
  })

  // Filter only Q/R sessions (no practice) and sort by order, then createdAt
  const qrSessions = sessions
    .filter(s => s.type === 'qualif' || s.type === 'race')
    .sort((a, b) => {
      if ((a.order ?? 0) !== (b.order ?? 0)) {
        return (a.order ?? 0) - (b.order ?? 0)
      }
      return new Date(a.createdAt) - new Date(b.createdAt)
    })

  // Get session display label (Q1, Q2, R1, R2...)
  const getSessionLabel = (session, index) => {
    const prefix = session.type === 'qualif' ? 'Q' : 'R'
    const sameType = qrSessions.filter(s => s.type === session.type)
    const typeIndex = sameType.findIndex(s => s.id === session.id) + 1
    return `${prefix}${typeIndex}`
  }

  // Save championship settings
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/championships/${championship.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          trackId: trackId || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      const data = await res.json()
      onSave(data.data)
      onClose()
    } catch (err) {
      console.error('Failed to save championship:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Create new session
  const handleCreateSession = async () => {
    if (!showNewSession) return

    try {
      const res = await fetch(`${API_URL}/api/championships/${championship.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: showNewSession,
          name: newSessionForm.name || undefined,
          maxDuration: newSessionForm.useTime ? newSessionForm.duration * 60 * 1000 : null, // minutes → ms
          maxLaps: newSessionForm.useLaps ? newSessionForm.maxLaps : null,
          order: qrSessions.length
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la creation')
      }

      // Reset form and refresh
      setShowNewSession(null)
      setNewSessionForm({ name: '', duration: 5, maxLaps: 10, useTime: true, useLaps: false })
      onSessionsChange?.()
    } catch (err) {
      console.error('Failed to create session:', err)
      setError(err.message)
    }
  }

  // Delete session
  const handleDeleteSession = async (sessionId) => {

    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Erreur lors de la suppression')
      }

      onSessionsChange?.()
    } catch (err) {
      console.error('Failed to delete session:', err)
      setError(err.message)
    }
  }

  // Update session
  const handleUpdateSession = async (sessionId) => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionForm.name || null,
          maxDuration: sessionForm.useTime ? sessionForm.duration * 60 * 1000 : null, // minutes → ms
          maxLaps: sessionForm.useLaps ? sessionForm.maxLaps : null
        })
      })

      if (!res.ok) {
        throw new Error('Erreur lors de la mise a jour')
      }

      setEditingSession(null)
      onSessionsChange?.()
    } catch (err) {
      console.error('Failed to update session:', err)
      setError(err.message)
    }
  }

  // Move session up/down
  const handleMoveSession = async (sessionId, direction) => {
    const index = qrSessions.findIndex(s => s.id === sessionId)
    if (index < 0) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= qrSessions.length) return

    // Swap orders
    const currentSession = qrSessions[index]
    const targetSession = qrSessions[newIndex]

    try {
      // Update both sessions
      await Promise.all([
        fetch(`${API_URL}/api/sessions/${currentSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newIndex })
        }),
        fetch(`${API_URL}/api/sessions/${targetSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: index })
        })
      ])

      onSessionsChange?.()
    } catch (err) {
      console.error('Failed to reorder sessions:', err)
      setError(err.message)
    }
  }

  // Start editing a session
  const startEditing = (session) => {
    setEditingSession(session.id)
    setSessionForm({
      name: session.name || '',
      duration: session.maxDuration ? Math.round(session.maxDuration / 60000) : 5, // ms → minutes
      maxLaps: session.maxLaps || 10,
      useTime: !!session.maxDuration,
      useLaps: !!session.maxLaps
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configuration Championnat"
      icon={<TrophyIcon className="w-5 h-5 text-yellow-500" />}
      size="2xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Championship Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nom du championnat
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Circuit
            </label>
            <select
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">-- Selectionner un circuit --</option>
              {tracks.map(track => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sessions Management */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sessions Qualifications & Courses
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewSession('qualif')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Qualif
              </button>
              <button
                onClick={() => setShowNewSession('race')}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Course
              </button>
            </div>
          </div>

          {/* Sessions List */}
          <div className="border dark:border-gray-600 rounded-lg divide-y dark:divide-gray-600">
            {qrSessions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                Aucune session. Ajoutez une qualification ou une course.
              </div>
            ) : (
              qrSessions.map((session, index) => {
                const config = SESSION_TYPES[session.type]
                const Icon = config.icon
                const isEditing = editingSession === session.id

                return (
                  <div key={session.id} className="p-3">
                    {isEditing ? (
                      // Edit mode
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                            {getSessionLabel(session, index)}
                          </span>
                          <input
                            type="text"
                            value={sessionForm.name}
                            onChange={(e) => setSessionForm(f => ({ ...f, name: e.target.value }))}
                            placeholder={config.label}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-yellow-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={sessionForm.useTime}
                              onChange={(e) => setSessionForm(f => ({ ...f, useTime: e.target.checked }))}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                            />
                            <ClockIcon className="w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={sessionForm.duration}
                              onChange={(e) => setSessionForm(f => ({ ...f, duration: parseInt(e.target.value) || 1 }))}
                              disabled={!sessionForm.useTime}
                              className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-500 dark:text-gray-400">min</span>
                          </label>

                          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={sessionForm.useLaps}
                              onChange={(e) => setSessionForm(f => ({ ...f, useLaps: e.target.checked }))}
                              className="rounded border-gray-300 dark:border-gray-600 text-green-600"
                            />
                            <ArrowPathIcon className="w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={sessionForm.maxLaps}
                              onChange={(e) => setSessionForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 1 }))}
                              disabled={!sessionForm.useLaps}
                              className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-500 dark:text-gray-400">tours</span>
                          </label>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingSession(null)}
                            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleUpdateSession(session.id)}
                            className="px-3 py-1 text-sm text-white bg-yellow-500 hover:bg-yellow-600 rounded"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <div className="flex items-center gap-3">
                        {/* Reorder buttons */}
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleMoveSession(session.id, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUpIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveSession(session.id, 'down')}
                            disabled={index === qrSessions.length - 1}
                            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDownIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Session info */}
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                            {getSessionLabel(session, index)}
                          </span>
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {session.name || config.label}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {session.maxDuration ? `${Math.round(session.maxDuration / 60000)} min` : ''}
                            {session.maxDuration && session.maxLaps ? ' / ' : ''}
                            {session.maxLaps ? `${session.maxLaps} tours` : ''}
                          </span>
                          {session.status !== 'draft' && (
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              session.status === 'finished' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                              session.status === 'active' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                              'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                            }`}>
                              {session.status}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditing(session)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Modifier"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* New session form */}
            {showNewSession && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SESSION_TYPES[showNewSession].color}`}>
                      {showNewSession === 'qualif' ? 'Q' : 'R'}{qrSessions.filter(s => s.type === showNewSession).length + 1}
                    </span>
                    <input
                      type="text"
                      value={newSessionForm.name}
                      onChange={(e) => setNewSessionForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={SESSION_TYPES[showNewSession].label}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-yellow-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newSessionForm.useTime}
                        onChange={(e) => setNewSessionForm(f => ({ ...f, useTime: e.target.checked }))}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={newSessionForm.duration}
                        onChange={(e) => setNewSessionForm(f => ({ ...f, duration: parseInt(e.target.value) || 1 }))}
                        disabled={!newSessionForm.useTime}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">min</span>
                    </label>

                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={newSessionForm.useLaps}
                        onChange={(e) => setNewSessionForm(f => ({ ...f, useLaps: e.target.checked }))}
                        className="rounded border-gray-300 dark:border-gray-600 text-green-600"
                      />
                      <ArrowPathIcon className="w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={newSessionForm.maxLaps}
                        onChange={(e) => setNewSessionForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 1 }))}
                        disabled={!newSessionForm.useLaps}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center disabled:bg-gray-100 dark:disabled:bg-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">tours</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNewSession(null)}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleCreateSession}
                      disabled={!newSessionForm.useTime && !newSessionForm.useLaps}
                      className={`px-3 py-1 text-sm text-white rounded disabled:opacity-50 ${
                        showNewSession === 'qualif' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      Creer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <ModalFooter>
          <ModalButton variant="secondary" onClick={onClose}>
            Fermer
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </ModalButton>
        </ModalFooter>
      </div>
    </Modal>
  )
}
