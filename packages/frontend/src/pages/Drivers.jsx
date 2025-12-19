import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PencilIcon,
  TrashIcon,
  TrophyIcon,
  FlagIcon,
  ChartBarIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline'
import {
  TrophyIcon as TrophySolidIcon,
} from '@heroicons/react/24/solid'
import { DriverListItem } from '../components/DriverDisplays'
import ImageCropper from '../components/ImageCropper'
import ErrorMessage from '../components/ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [error, setError] = useState('')

  useEffect(() => {
    loadDrivers()
  }, [])

  async function loadDrivers() {
    try {
      const res = await fetch(`${API_URL}/drivers`)
      const data = await res.json()
      setDrivers(data.data || [])
    } catch (error) {
      console.error('Failed to load drivers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteDriver(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce pilote ?')) return

    try {
      await fetch(`${API_URL}/drivers/${id}`, { method: 'DELETE' })
      await loadDrivers()
    } catch (error) {
      console.error('Failed to delete driver:', error)
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 5000)
    }
  }

  function handleEdit(driver) {
    setEditingDriver(driver)
    setShowForm(true)
  }

  function handleDelete(driver) {
    deleteDriver(driver.id)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingDriver(null)
    loadDrivers()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pilotes</h1>
          <p className="text-gray-600 mt-1">{drivers.length} pilote{drivers.length > 1 ? 's' : ''} enregistré{drivers.length > 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`
                px-3 py-2 rounded-md transition-all flex items-center gap-2
                ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <Squares2X2Icon className="w-5 h-5" />
              <span className="text-sm font-medium">Grille</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`
                px-3 py-2 rounded-md transition-all flex items-center gap-2
                ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <ListBulletIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Liste</span>
            </button>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Ajouter un pilote
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {/* Drivers Display */}
      {drivers.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onEdit={() => handleEdit(driver)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3 bg-white rounded-lg shadow p-6">
            {drivers.map((driver, index) => (
              <DriverListItem
                key={driver.id}
                driver={driver}
                position={index + 1}
                onClick={() => handleEdit(driver)}
                showStats={true}
              />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg mb-4">Aucun pilote enregistré</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajouter le premier pilote
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <DriverForm
          driver={editingDriver}
          onClose={handleFormClose}
          onDelete={editingDriver ? () => handleDelete(editingDriver) : undefined}
        />
      )}
    </div>
  )
}

function DriverCard({ driver, onEdit }) {
  const navigate = useNavigate()

  // Générer un gradient basé sur la couleur du driver
  const getGradient = (color) => {
    return `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`
  }

  const getBorderGlow = (color) => {
    return `0 0 20px ${color}40, 0 0 40px ${color}20`
  }

  const wins = driver.wins || 0
  const podiums = driver.podiums || 0

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer"
      style={{
        background: getGradient(driver.color),
        boxShadow: `0 4px 6px rgba(0,0,0,0.1), ${getBorderGlow(driver.color)}`
      }}
      onClick={() => navigate(`/drivers/${driver.id}`)}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${driver.color},
            ${driver.color} 10px,
            transparent 10px,
            transparent 20px
          )`
        }}
      />

      {/* Header avec avatar */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Avatar avec effet NASCAR/F1 */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-md opacity-50"
              style={{ backgroundColor: driver.color }}
            />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)`,
              }}
            >
              {driver.photo ? (
                <img
                  src={driver.photo}
                  alt={driver.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="drop-shadow-lg">{driver.name.charAt(0)}</span>
              )}
            </div>

            {/* Badge victoires si présent */}
            {wins > 0 && (
              <div
                className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white shadow-lg"
                title={`${wins} victoire${wins > 1 ? 's' : ''}`}
              >
                <TrophySolidIcon className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Racing Number NASCAR/F1 style */}
            {driver.number && (
              <div
                className="relative w-16 h-16 rounded-lg flex items-center justify-center shadow-lg overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}DD 100%)`,
                }}
              >
                {/* Number background effect */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      -45deg,
                      transparent,
                      transparent 5px,
                      rgba(255,255,255,0.3) 5px,
                      rgba(255,255,255,0.3) 10px
                    )`
                  }}
                />
                <span
                  className="relative text-4xl font-black text-white drop-shadow-lg"
                  style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 20px rgba(0,0,0,0.2)'
                  }}
                >
                  {driver.number}
                </span>
              </div>
            )}

            {/* Team badge */}
            {driver.team && (
              <div
                className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: driver.team.color || driver.color }}
              >
                {driver.team.name}
              </div>
            )}
          </div>
        </div>

        {/* Nom du pilote style F1 */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3
              className="font-black text-2xl tracking-tight"
              style={{
                color: driver.color,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {driver.name.toUpperCase()}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white hover:scale-110 transition-all duration-200 flex items-center justify-center shadow-md flex-shrink-0"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 w-16 rounded-full" style={{ backgroundColor: driver.color }} />
        </div>
      </div>

      {/* Stats NASCAR style */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <StatBadge
            icon={<FlagIcon className="w-4 h-4" />}
            label="Courses"
            value={driver._count?.sessions || 0}
            color={driver.color}
          />
          <StatBadge
            icon={<TrophyIcon className="w-4 h-4" />}
            label="Podiums"
            value={podiums}
            color={driver.color}
            highlight={podiums > 0}
          />
          <StatBadge
            icon={<ChartBarIcon className="w-4 h-4" />}
            label="Tours"
            value={driver._count?.laps || 0}
            color={driver.color}
          />
        </div>

        {/* Meilleur tour */}
        {driver.bestLap && (
          <div
            className="mt-3 p-3 rounded-lg bg-white/80 backdrop-blur-sm border-2"
            style={{ borderColor: `${driver.color}40` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Meilleur Tour
              </span>
              <span
                className="text-lg font-black tabular-nums"
                style={{ color: driver.color }}
              >
                {(driver.bestLap / 1000).toFixed(3)}s
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Racing stripe effect */}
      <div
        className="absolute top-0 left-0 w-1 h-full opacity-80"
        style={{ backgroundColor: driver.color }}
      />
    </div>
  )
}

function StatBadge({ icon, label, value, color, highlight }) {
  return (
    <div
      className={`
        p-2 rounded-lg text-center transition-all duration-200
        ${highlight ? 'bg-yellow-50 ring-2 ring-yellow-400' : 'bg-white/60 backdrop-blur-sm'}
      `}
    >
      <div
        className="flex items-center justify-center mb-1"
        style={{ color: highlight ? '#EAB308' : color }}
      >
        {icon}
      </div>
      <div className="text-xs font-medium text-gray-600 mb-0.5 uppercase tracking-wide">
        {label}
      </div>
      <div
        className="text-lg font-black tabular-nums"
        style={{ color: highlight ? '#EAB308' : color }}
      >
        {value}
      </div>
    </div>
  )
}

function DriverForm({ driver, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    name: driver?.name || '',
    number: driver?.number || '',
    email: driver?.email || '',
    photo: driver?.photo || '',
    color: driver?.color || '#3B82F6',
    teamId: driver?.teamId || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [photoPreview, setPhotoPreview] = useState(driver?.photo || '')
  const [imageToCrop, setImageToCrop] = useState(null) // Image à cropper
  const [showCropper, setShowCropper] = useState(false)
  const [teams, setTeams] = useState([])

  // Load teams
  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch(`${API_URL}/teams`)
        const data = await res.json()
        setTeams(data.data || [])
      } catch (error) {
        console.error('Failed to load teams:', error)
      }
    }
    loadTeams()
  }, [])

  // Handle file upload - Ouvre le cropper
  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (file) {
      // Check file type only (no size limit!)
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner une image.')
        return
      }

      // Convert to base64 and open cropper
      const reader = new FileReader()
      reader.onloadend = () => {
        setImageToCrop(reader.result)
        setShowCropper(true)
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle cropped image
  function handleCropComplete(croppedImage) {
    setFormData({ ...formData, photo: croppedImage })
    setPhotoPreview(croppedImage)
    setShowCropper(false)
    setImageToCrop(null)
  }

  // Handle crop cancel
  function handleCropCancel() {
    setShowCropper(false)
    setImageToCrop(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const url = driver
        ? `${API_URL}/drivers/${driver.id}`
        : `${API_URL}/drivers`

      const method = driver ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setSuccess('Pilote sauvegardé avec succès')
        setTimeout(() => onClose(), 1500)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Failed to save driver:', error)
      setError('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-6">
          {driver ? 'Modifier le pilote' : 'Nouveau pilote'}
        </h2>

        {error && (
          <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}

        {success && (
          <ErrorMessage type="success" message={success} className="mb-4" />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Lewis Hamilton"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de course (1-999)
            </label>
            <input
              type="number"
              min="1"
              max="999"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value ? parseInt(e.target.value) : '' })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="44"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="lewis@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo de profil
            </label>

            {/* Photo preview */}
            {photoPreview && (
              <div className="mb-3 flex justify-center">
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, photo: '' })
                      setPhotoPreview('')
                    }}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Upload button */}
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <div className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors text-center">
                  <span className="text-sm text-gray-600">
                    📁 Choisir une image
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              L'image sera recadrée • JPG, PNG, GIF
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couleur
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Équipe
            </label>
            <select
              value={formData.teamId}
              onChange={(e) => setFormData({ ...formData, teamId: e.target.value || null })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Aucune équipe</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Assignez ce pilote à une équipe (optionnel)
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

            {driver && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onDelete()
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Supprimer le pilote
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Image Cropper Modal */}
      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          cropShape="round"
          aspect={1}
        />
      )}
    </div>
  )
}
