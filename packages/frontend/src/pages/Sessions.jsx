import { useState, useEffect } from 'react'
import {
  CalendarIcon,
  FlagIcon,
  UsersIcon,
  TrophyIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import ErrorMessage from '../components/ErrorMessage'

// Session Card Component
function SessionCard({ session, onEdit, onClick }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'Date non définie'
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = () => {
    if (!session.startTime) return { color: 'bg-gray-100 text-gray-700', text: 'Planifiée' }
    if (!session.endTime) return { color: 'bg-green-100 text-green-700', text: 'En cours' }
    return { color: 'bg-blue-100 text-blue-700', text: 'Terminée' }
  }

  const status = getStatusBadge()

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer"
    >
      {/* Header with track photo */}
      <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
        {session.track?.img && (
          <img
            src={session.track.img}
            alt={session.track.name}
            className="w-full h-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
            {status.text}
          </span>
        </div>
        <div className="absolute bottom-2 left-3">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            {session.name || `Session #${session.id}`}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(session)
              }}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Track */}
        {session.track && (
          <div className="flex items-center gap-2 text-sm">
            <MapPinIcon className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{session.track.name}</span>
            {session.track.length && (
              <span className="text-gray-500">• {session.track.length}m</span>
            )}
          </div>
        )}

        {/* Championship */}
        {session.championship && (
          <div className="flex items-center gap-2 text-sm">
            <TrophyIcon className="h-4 w-4 text-yellow-500" />
            <span>{session.championship.name}</span>
          </div>
        )}

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarIcon className="h-4 w-4" />
          <span>{formatDate(session.date)}</span>
        </div>

        {/* Participants */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <UsersIcon className="h-4 w-4 text-blue-500" />
              {session.drivers?.length || 0} pilotes
            </span>
            <span className="flex items-center gap-1">
              <FlagIcon className="h-4 w-4 text-green-500" />
              {session.laps?.length || 0} tours
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Session Form Component
function SessionForm({ session, onClose, onSave, tracks, championships, drivers, cars }) {
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 16),
    trackId: null,
    championshipId: null,
    practiceMode: false,
    maxLaps: 0,
    maxTime: 0,
    startTime: null,
    endTime: null,
    selectedDrivers: [],
    selectedCars: []
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session) {
      setFormData({
        name: session.name || '',
        date: session.date ? new Date(session.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        trackId: session.trackId,
        championshipId: session.championshipId,
        practiceMode: session.practiceMode || false,
        maxLaps: session.maxLaps || 0,
        maxTime: session.maxTime || 0,
        startTime: session.startTime,
        endTime: session.endTime,
        selectedDrivers: session.drivers?.map(sd => ({
          driverId: sd.driverId,
          carId: sd.carId,
          controller: sd.controller
        })) || [],
        selectedCars: session.cars?.map(sc => sc.carId) || []
      })
    }
  }, [session])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const sessionData = {
      ...formData,
      date: new Date(formData.date).toISOString(),
      trackId: formData.trackId ? parseInt(formData.trackId) : null,
      championshipId: formData.championshipId ? parseInt(formData.championshipId) : null,
      maxLaps: parseInt(formData.maxLaps) || null,
      maxTime: parseInt(formData.maxTime) || null,
      drivers: formData.selectedDrivers,
      cars: formData.selectedCars
    }

    try {
      const url = session
        ? `http://localhost:3000/api/sessions/${session.id}`
        : 'http://localhost:3000/api/sessions'

      const response = await fetch(url, {
        method: session ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      })

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde')

      const data = await response.json()
      setSuccess('Session sauvegardée avec succès')
      setTimeout(() => {
        onSave(data)
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Error saving session:', error)
      setError('Erreur lors de la sauvegarde de la session')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!session) return
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`http://localhost:3000/api/sessions/${session.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erreur lors de la suppression')

      onSave(null)
      onClose()
    } catch (error) {
      console.error('Error deleting session:', error)
      setError('Erreur lors de la suppression de la session')
    } finally {
      setSaving(false)
    }
  }

  const addDriver = () => {
    setFormData({
      ...formData,
      selectedDrivers: [...formData.selectedDrivers, { driverId: null, carId: null, controller: 1 }]
    })
  }

  const updateDriver = (index, field, value) => {
    const updated = [...formData.selectedDrivers]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, selectedDrivers: updated })
  }

  const removeDriver = (index) => {
    setFormData({
      ...formData,
      selectedDrivers: formData.selectedDrivers.filter((_, i) => i !== index)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          {session ? 'Modifier la session' : 'Nouvelle session'}
        </h2>

        {error && (
          <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}

        {success && (
          <ErrorMessage type="success" message={success} className="mb-4" />
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la session
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Qualification, Course 1, Essais libres..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date et heure *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Circuit *
              </label>
              <select
                required
                value={formData.trackId || ''}
                onChange={(e) => setFormData({ ...formData, trackId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sélectionner un circuit</option>
                {tracks.map(track => (
                  <option key={track.id} value={track.id}>
                    {track.name} {track.length && `(${track.length}m)`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Championnat
              </label>
              <select
                value={formData.championshipId || ''}
                onChange={(e) => setFormData({ ...formData, championshipId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Aucun (session libre)</option>
                {championships.map(champ => (
                  <option key={champ.id} value={champ.id}>
                    {champ.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode entraînement
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.practiceMode}
                  onChange={(e) => setFormData({ ...formData, practiceMode: e.target.checked })}
                  className="rounded text-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-sm">Activer le mode entraînement</span>
              </label>
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de tours max
              </label>
              <input
                type="number"
                min="0"
                value={formData.maxLaps}
                onChange={(e) => setFormData({ ...formData, maxLaps: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="0 = illimité"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée max (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.maxTime}
                onChange={(e) => setFormData({ ...formData, maxTime: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="0 = illimité"
              />
            </div>
          </div>

          {/* Drivers */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Pilotes participants
              </label>
              <button
                type="button"
                onClick={addDriver}
                className="px-3 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Ajouter un pilote
              </button>
            </div>

            <div className="space-y-2">
              {formData.selectedDrivers.map((sd, index) => (
                <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded">
                  <select
                    value={sd.driverId || ''}
                    onChange={(e) => updateDriver(index, 'driverId', parseInt(e.target.value))}
                    className="flex-1 px-3 py-1 border rounded focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner un pilote</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} #{driver.number}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sd.carId || ''}
                    onChange={(e) => updateDriver(index, 'carId', parseInt(e.target.value))}
                    className="flex-1 px-3 py-1 border rounded focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner une voiture</option>
                    {cars.map(car => (
                      <option key={car.id} value={car.id}>
                        {car.brand} {car.model}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={sd.controller}
                    onChange={(e) => updateDriver(index, 'controller', parseInt(e.target.value))}
                    className="w-20 px-3 py-1 border rounded focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ctrl"
                  />

                  <button
                    type="button"
                    onClick={() => removeDriver(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4">
            <div>
              {session && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 disabled:opacity-50"
                >
                  <TrashIcon className="h-5 w-5" />
                  {saving ? 'Suppression...' : 'Supprimer'}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : (session ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Main Sessions Page
export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [tracks, setTracks] = useState([])
  const [championships, setChampionships] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [viewMode, setViewMode] = useState('grid')
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/sessions')
      const data = await response.json()
      setSessions(data.data || [])
    } catch (err) {
      console.error('Error fetching sessions:', err)
    }
  }

  const fetchTracks = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tracks')
      const data = await response.json()
      setTracks(data.data || [])
    } catch (err) {
      console.error('Error fetching tracks:', err)
    }
  }

  const fetchChampionships = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/championships')
      const data = await response.json()
      setChampionships(data.data || [])
    } catch (err) {
      console.error('Error fetching championships:', err)
    }
  }

  const fetchDrivers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/drivers')
      const data = await response.json()
      setDrivers(data.data || [])
    } catch (err) {
      console.error('Error fetching drivers:', err)
    }
  }

  const fetchCars = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/cars')
      const data = await response.json()
      setCars(data.data || [])
    } catch (err) {
      console.error('Error fetching cars:', err)
    }
  }

  useEffect(() => {
    fetchSessions()
    fetchTracks()
    fetchChampionships()
    fetchDrivers()
    fetchCars()
  }, [])

  const handleEdit = (session) => {
    setEditingSession(session)
    setShowForm(true)
  }

  const handleNew = () => {
    setEditingSession(null)
    setShowForm(true)
  }

  const handleSave = () => {
    fetchSessions()
  }

  const handleCardClick = (session) => {
    setSelectedSession(session)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (session) => {
    if (!session.startTime) return { color: 'bg-gray-100 text-gray-700', text: 'Planifiée' }
    if (!session.endTime) return { color: 'bg-green-100 text-green-700', text: 'En cours' }
    return { color: 'bg-blue-100 text-blue-700', text: 'Terminée' }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Sessions de course</h1>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Nouvelle session
          </button>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-gray-600">
            {sessions.length} session{sessions.length > 1 ? 's' : ''}
          </p>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
            >
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              onEdit={handleEdit}
              onClick={() => handleCardClick(session)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Circuit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Championnat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map(session => {
                const status = getStatusBadge(session)
                return (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleCardClick(session)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {session.name || `Session #${session.id}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {session.track?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {session.championship?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(session.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.drivers?.length || 0} pilotes
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(session)
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Forms */}
      {showForm && (
        <SessionForm
          session={editingSession}
          onClose={() => {
            setShowForm(false)
            setEditingSession(null)
          }}
          onSave={handleSave}
          tracks={tracks}
          championships={championships}
          drivers={drivers}
          cars={cars}
        />
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedSession.name || `Session #${selectedSession.id}`}
                </h2>
                <p className="text-gray-600 mt-1">
                  {formatDate(selectedSession.date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Session Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold mb-2">Informations</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Circuit:</span>
                    <span className="font-medium">{selectedSession.track?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Championnat:</span>
                    <span className="font-medium">{selectedSession.championship?.name || 'Session libre'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-medium">{selectedSession.practiceMode ? 'Entraînement' : 'Course'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Limites</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tours max:</span>
                    <span className="font-medium">{selectedSession.maxLaps || 'Illimité'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Durée max:</span>
                    <span className="font-medium">{selectedSession.maxTime ? `${selectedSession.maxTime} min` : 'Illimité'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Participants */}
            {selectedSession.drivers && selectedSession.drivers.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Participants</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedSession.drivers.map((sd) => (
                    <div key={sd.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {sd.driver?.img && (
                        <img
                          src={sd.driver.img}
                          alt={sd.driver.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">
                          {sd.driver?.name} #{sd.driver?.number}
                        </div>
                        <div className="text-sm text-gray-600">
                          {sd.car?.brand} {sd.car?.model}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Ctrl {sd.controller}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedSession(null)
                  handleEdit(selectedSession)
                }}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2"
              >
                <PencilIcon className="h-5 w-5" />
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}