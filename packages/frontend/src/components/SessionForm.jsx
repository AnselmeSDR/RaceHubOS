import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function SessionForm({ session, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'practice',
    trackId: '',
    championshipId: '',
    duration: null,
    maxLaps: null,
    fuelMode: 'OFF',
    drivers: [],
  })

  const [tracks, setTracks] = useState([])
  const [championships, setChampionships] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [availableSlots, setAvailableSlots] = useState(6) // Nombre de slots disponibles

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (session) {
      setFormData({
        name: session.name || '',
        type: session.type || 'practice',
        trackId: session.trackId || '',
        championshipId: session.championshipId || '',
        duration: session.duration || null,
        maxLaps: session.maxLaps || null,
        fuelMode: session.fuelMode || 'OFF',
        drivers: session.drivers?.map(sd => ({
          driverId: sd.driverId,
          carId: sd.carId,
          controller: sd.controller || '',
          gridPos: sd.gridPos || null,
          position: sd.position || null,
        })) || [],
      })
    }
  }, [session])

  async function loadData() {
    try {
      const [tracksRes, championshipsRes, driversRes, carsRes, simulatorRes] = await Promise.all([
        fetch(`${API_URL}/tracks`),
        fetch(`${API_URL}/championships`),
        fetch(`${API_URL}/drivers`),
        fetch(`${API_URL}/cars`),
        fetch(`${API_URL}/simulator`), // Récupérer les infos du simulateur/CU
      ])

      const tracksData = await tracksRes.json()
      const chipsData = await championshipsRes.json()
      const driversData = await driversRes.json()
      const carsData = await carsRes.json()
      const simulatorData = await simulatorRes.json()

      setTracks(tracksData.data || [])
      setChampionships(chipsData.data || [])
      setDrivers(driversData.data || [])
      setCars(carsData.data || [])

      // Récupérer le nombre de slots disponibles
      if (simulatorData.isMockDevice) {
        // Mode simulateur
        setAvailableSlots(simulatorData.cars?.length || 6)
      } else if (simulatorData.cuNumCars) {
        // Mode Control Unit réel
        setAvailableSlots(simulatorData.cuNumCars)
      } else {
        // Par défaut
        setAvailableSlots(6)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      // Validation
      if (!formData.trackId) {
        setError('Le circuit est requis')
        return
      }

      // Valider les drivers - filtrer les drivers incomplets
      const validDrivers = formData.drivers.filter(
        d => d.driverId && d.carId && d.controller
      )

      if (formData.drivers.length > 0 && validDrivers.length === 0) {
        setError('Au moins un pilote complet est requis (pilote, voiture, contrôleur)')
        return
      }

      const dataToSend = {
        ...formData,
        drivers: validDrivers,
      }

      const method = session ? 'PUT' : 'POST'
      const url = session ? `${API_URL}/sessions/${session.id}` : `${API_URL}/sessions`

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      const result = await response.json()
      onSaved(result.data)
      onClose()
    } catch (err) {
      console.error('Error saving session:', err)
      setError(err.message || 'Erreur lors de la sauvegarde')
    }
  }

  function addDriver() {
    // Trouver le prochain contrôleur disponible
    const usedControllers = formData.drivers.map(d => d.controller)
    const nextController = Array.from({ length: availableSlots }, (_, i) => String(i + 1))
      .find(c => !usedControllers.includes(c)) || ''

    setFormData({
      ...formData,
      drivers: [
        ...formData.drivers,
        { driverId: '', carId: '', controller: nextController, gridPos: null, position: null },
      ],
    })
  }

  function removeDriver(index) {
    setFormData({
      ...formData,
      drivers: formData.drivers.filter((_, i) => i !== index),
    })
  }

  function updateDriver(index, field, value) {
    const updated = [...formData.drivers]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, drivers: updated })
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">
            {session ? 'Modifier la session' : 'Nouvelle session'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form id="session-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Informations générales</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: Essais libres Nürburgring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="practice">Essais libres</option>
                  <option value="qualif">Qualifications</option>
                  <option value="race">Course</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Circuit</label>
                <select
                  required
                  value={formData.trackId}
                  onChange={(e) => setFormData({ ...formData, trackId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner un circuit</option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Championnat (optionnel)</label>
                <select
                  value={formData.championshipId}
                  onChange={(e) => setFormData({ ...formData, championshipId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Aucun</option>
                  {championships.map((champ) => (
                    <option key={champ.id} value={champ.id}>
                      {champ.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carburant</label>
                <select
                  value={formData.fuelMode}
                  onChange={(e) => setFormData({ ...formData, fuelMode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="OFF">Désactivé</option>
                  <option value="ON">Activé</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
                <input
                  type="number"
                  value={formData.duration || ''}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tours max</label>
                <input
                  type="number"
                  value={formData.maxLaps || ''}
                  onChange={(e) => setFormData({ ...formData, maxLaps: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="100"
                />
              </div>
            </div>
          </div>

          {/* Drivers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">Pilotes</h3>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                  {formData.drivers.length}/{availableSlots} slots
                </span>
              </div>
              <button
                type="button"
                onClick={addDriver}
                disabled={formData.drivers.length >= availableSlots}
                className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {formData.drivers.map((driver, index) => (
                <div key={index} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                  <select
                    value={driver.driverId}
                    onChange={(e) => updateDriver(index, 'driverId', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Pilote</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={driver.carId}
                    onChange={(e) => updateDriver(index, 'carId', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Voiture</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.brand} {c.model}
                      </option>
                    ))}
                  </select>

                  <select
                    value={driver.controller}
                    onChange={(e) => updateDriver(index, 'controller', e.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Ctrl</option>
                    {Array.from({ length: availableSlots }, (_, i) => i + 1).map((slot) => {
                      const isUsed = formData.drivers.some((d, idx) => idx !== index && d.controller === String(slot))
                      return (
                        <option
                          key={slot}
                          value={slot}
                          disabled={isUsed}
                        >
                          {slot} {isUsed ? '(utilisé)' : ''}
                        </option>
                      )
                    })}
                  </select>

                  <input
                    type="number"
                    value={driver.gridPos || ''}
                    onChange={(e) => updateDriver(index, 'gridPos', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Grille"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => removeDriver(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}

              {formData.drivers.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Aucun pilote ajouté</p>
              )}
            </div>
          </div>

        </form>

        {/* Actions Footer */}
        <div className="flex gap-3 p-6 border-t flex-shrink-0 bg-white">
          <button
            form="session-form"
            type="submit"
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {session ? 'Mettre à jour' : 'Créer la session'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
