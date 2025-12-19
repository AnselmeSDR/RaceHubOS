import { useState, useEffect } from 'react'
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MapPinIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import {
  MapPinIcon as MapPinSolidIcon,
  TrophyIcon as TrophySolidIcon,
} from '@heroicons/react/24/solid'
import ImageCropper from '../components/ImageCropper'
import ErrorMessage from '../components/ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Tracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTrack, setEditingTrack] = useState(null)

  useEffect(() => {
    loadTracks()
  }, [])

  async function loadTracks() {
    try {
      const res = await fetch(`${API_URL}/tracks`)
      const data = await res.json()
      setTracks(data.data || [])
    } catch (error) {
      console.error('Failed to load tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteTrack(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce circuit ?')) return

    try {
      const res = await fetch(`${API_URL}/tracks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await loadTracks()
      } else {
        const errorData = await res.json()
        console.error('Failed to delete track:', errorData)
      }
    } catch (error) {
      console.error('Failed to delete track:', error)
    }
  }

  function handleEdit(track) {
    setEditingTrack(track)
    setShowForm(true)
  }

  function handleDelete(track) {
    deleteTrack(track.id)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingTrack(null)
    loadTracks()
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
          <h1 className="text-3xl font-bold text-gray-900">Circuits</h1>
          <p className="text-gray-600 mt-1">{tracks.length} circuit{tracks.length > 1 ? 's' : ''} enregistré{tracks.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Ajouter un circuit
        </button>
      </div>

      {/* Tracks Grid */}
      {tracks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onEdit={() => handleEdit(track)}
              onDelete={() => handleDelete(track)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <MapPinIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Aucun circuit enregistré</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Ajouter le premier circuit
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TrackForm
          track={editingTrack}
          onClose={handleFormClose}
          onDelete={editingTrack ? () => handleDelete(editingTrack) : undefined}
        />
      )}
    </div>
  )
}

function TrackCard({ track, onEdit, onDelete }) {
  const trackColor = track.color || '#9333ea' // Utilise la couleur du circuit ou violet par défaut

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group bg-white"
      style={{
        background: `linear-gradient(135deg, ${trackColor}10 0%, ${trackColor}05 100%)`,
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${trackColor},
            ${trackColor} 10px,
            transparent 10px,
            transparent 20px
          )`
        }}
      />

      {/* Header avec icon */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Icon */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-xl blur-md opacity-50"
              style={{ backgroundColor: trackColor }}
            />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${trackColor} 0%, ${trackColor}CC 100%)`,
              }}
            >
              {track.photo ? (
                <img
                  src={track.photo}
                  alt={track.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <MapPinSolidIcon className="w-10 h-10 drop-shadow-lg" />
              )}
            </div>
          </div>

          {/* Record badge */}
          {track.bestLap && (
            <div className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-white shadow-md flex items-center gap-1">
              <TrophySolidIcon className="w-3 h-3" />
              Record
            </div>
          )}
        </div>

        {/* Nom du circuit */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3
              className="font-black text-xl tracking-tight text-gray-900 uppercase"
            >
              {track.name}
            </h3>
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white hover:scale-110 transition-all duration-200 flex items-center justify-center shadow-md flex-shrink-0"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: trackColor }} />
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pb-6">
        <div className="space-y-3">
          {/* Longueur */}
          {track.length && (
            <div className="flex items-center justify-between p-2 bg-white/60 backdrop-blur-sm rounded-lg">
              <div className="flex items-center gap-2">
                <RocketLaunchIcon className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-600 uppercase">Longueur</span>
              </div>
              <span className="text-sm font-black text-purple-600">{track.length}m</span>
            </div>
          )}

          {/* Virages */}
          {track.corners && (
            <div className="flex items-center justify-between p-2 bg-white/60 backdrop-blur-sm rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-600 uppercase">Virages</span>
              </div>
              <span className="text-sm font-black text-purple-600">{track.corners}</span>
            </div>
          )}

          {/* Best Lap */}
          {track.bestLap && (
            <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-bold text-yellow-900 uppercase">Record</span>
                </div>
                <span className="text-lg font-black text-yellow-600">
                  {(track.bestLap / 1000).toFixed(3)}s
                </span>
              </div>
              {track.bestLapBy && (
                <div className="text-xs text-yellow-700 text-right">
                  par {track.bestLapBy}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Courses</span>
            <span className="text-lg font-black" style={{ color: trackColor }}>
              {track._count?.sessions || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Racing stripe effect */}
      <div
        className="absolute top-0 left-0 w-1 h-full opacity-80"
        style={{ backgroundColor: trackColor }}
      />
    </div>
  )
}

function TrackForm({ track, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    name: track?.name || '',
    length: track?.length || '',
    corners: track?.corners || '',
    photo: track?.photo || '',
    color: track?.color || '#9333ea',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [photoPreview, setPhotoPreview] = useState(track?.photo || '')
  const [imageToCrop, setImageToCrop] = useState(null)
  const [showCropper, setShowCropper] = useState(false)

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
      const url = track
        ? `${API_URL}/tracks/${track.id}`
        : `${API_URL}/tracks`

      const method = track ? 'PUT' : 'POST'

      const payload = {
        name: formData.name,
        photo: formData.photo || null,
        length: formData.length ? parseFloat(formData.length) : null,
        corners: formData.corners ? parseInt(formData.corners) : null,
        color: formData.color || '#9333ea',
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSuccess('Circuit sauvegardé avec succès')
        setTimeout(() => onClose(), 1500)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Failed to save track:', error)
      setError('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-6">
          {track ? 'Modifier le circuit' : 'Nouveau circuit'}
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Monaco Grand Prix"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo du circuit
            </label>

            {/* Photo preview */}
            {photoPreview && (
              <div className="mb-3 flex justify-center">
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    className="w-32 h-32 rounded-xl object-cover ring-4 ring-gray-200"
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
                <div className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 transition-colors text-center">
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
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="#9333ea"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longueur (mètres)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.length}
              onChange={(e) => setFormData({ ...formData, length: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="12.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de virages
            </label>
            <input
              type="number"
              value={formData.corners}
              onChange={(e) => setFormData({ ...formData, corners: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="18"
            />
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
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

            {track && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onDelete()
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Supprimer le circuit
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
          cropShape="rect"
          aspect={1}
        />
      )}
    </div>
  )
}
