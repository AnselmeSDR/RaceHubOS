import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPinIcon,
  PencilIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { MapPinIcon as MapPinSolidIcon, TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import ErrorMessage from '../components/ErrorMessage'
import { useFetch } from '../hooks/useFetch'
import {
  PageHeader,
  EmptyState,
  FormModal,
  TextField,
  PhotoUploadField,
  ColorPickerField
} from '../components/crud'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const PRIMARY_COLOR = '#9333EA'

export default function Tracks() {
  const navigate = useNavigate()
  const { data: tracks = [], loading, refetch } = useFetch('/api/tracks')
  const [showForm, setShowForm] = useState(false)
  const [editingTrack, setEditingTrack] = useState(null)
  const [error, setError] = useState('')

  async function deleteTrack(id) {
    try {
      const res = await fetch(`${API_URL}/api/tracks/${id}`, { method: 'DELETE' })
      if (res.ok) refetch()
    } catch {
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 5000)
    }
  }

  function handleEdit(track) {
    setEditingTrack(track)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingTrack(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Circuits"
        icon={<MapPinIcon className="w-8 h-8" />}
        count={tracks.length}
        countLabel={`circuit${tracks.length > 1 ? 's' : ''} enregistré${tracks.length > 1 ? 's' : ''}`}
        onAdd={() => setShowForm(true)}
        addLabel="Ajouter un circuit"
        primaryColor={PRIMARY_COLOR}
      />

      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {tracks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} onClick={() => navigate(`/tracks/${track.id}`)} onEdit={() => handleEdit(track)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<MapPinIcon className="w-8 h-8" />}
          title="Aucun circuit enregistré"
          message="Ajoutez votre premier circuit pour commencer"
          actionLabel="Ajouter le premier circuit"
          onAction={() => setShowForm(true)}
          primaryColor={PRIMARY_COLOR}
        />
      )}

      {showForm && (
        <TrackFormModal
          track={editingTrack}
          onClose={handleFormClose}
          onDelete={editingTrack ? () => deleteTrack(editingTrack.id) : undefined}
        />
      )}
    </div>
  )
}

function TrackCard({ track, onClick, onEdit }) {
  const trackColor = track.color || '#9333EA'

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all cursor-pointer"
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${trackColor}10 0%, ${trackColor}05 100%)`
      }}
    >
      {/* Racing stripe */}
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: trackColor }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Icon/Photo */}
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: trackColor }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${trackColor} 0%, ${trackColor}CC 100%)` }}
            >
              {track.img ? (
                <img src={track.img} alt={track.name} className="w-full h-full object-cover" />
              ) : (
                <MapPinSolidIcon className="w-10 h-10 drop-shadow-lg" />
              )}
            </div>
          </div>

          {track.bestLap && (
            <div className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-white shadow-md flex items-center gap-1">
              <TrophySolidIcon className="w-3 h-3" />
              Record
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-black text-xl tracking-tight text-gray-900 dark:text-white uppercase">{track.name}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="w-8 h-8 rounded-lg bg-white/90 dark:bg-gray-700/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 hover:scale-110 transition-all flex items-center justify-center shadow-md"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: trackColor }} />
        </div>
      </div>

      <div className="px-6 pb-6 space-y-3">
        {track.length && (
          <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
            <div className="flex items-center gap-2">
              <RocketLaunchIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Longueur</span>
            </div>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400">{track.length}m</span>
          </div>
        )}

        {track.corners && (
          <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Virages</span>
            </div>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400">{track.corners}</span>
          </div>
        )}

        {track.bestLap && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-bold text-yellow-900 dark:text-yellow-300 uppercase">Record</span>
              </div>
              <span className="text-lg font-black text-yellow-600 dark:text-yellow-400">{(track.bestLap / 1000).toFixed(3)}s</span>
            </div>
            {track.bestLapBy && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 text-right">par {track.bestLapBy}</div>
            )}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Courses</span>
            <span className="text-lg font-black" style={{ color: trackColor }}>{track._count?.sessions || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackFormModal({ track, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    name: track?.name || '',
    length: track?.length || '',
    corners: track?.corners || '',
    img: track?.img || '',
    color: track?.color || '#9333EA'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = track ? `${API_URL}/api/tracks/${track.id}` : `${API_URL}/api/tracks`
      const payload = {
        name: formData.name,
        img: formData.img || null,
        length: formData.length ? parseFloat(formData.length) : null,
        corners: formData.corners ? parseInt(formData.corners) : null,
        color: formData.color
      }
      const res = await fetch(url, {
        method: track ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setSuccess('Circuit sauvegardé avec succès')
        setTimeout(() => onClose(), 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    onClose()
    onDelete?.()
  }

  return (
    <FormModal
      open
      onClose={onClose}
      title={track ? 'Modifier le circuit' : 'Nouveau circuit'}
      icon={<MapPinIcon className="w-5 h-5 text-purple-500" />}
      onSubmit={handleSubmit}
      onDelete={onDelete ? handleDelete : undefined}
      isEditing={!!track}
      saving={saving}
      error={error}
      success={success}
      primaryColor={PRIMARY_COLOR}
    >
      <TextField
        label="Nom"
        value={formData.name}
        onChange={(v) => setFormData(f => ({ ...f, name: v }))}
        placeholder="Monaco Grand Prix"
        required
      />

      <PhotoUploadField
        label="Photo du circuit"
        value={formData.img}
        onChange={(img) => setFormData(f => ({ ...f, img }))}
        shape="rect"
        primaryColor={PRIMARY_COLOR}
        onError={setError}
        uploadType="tracks"
      />

      <ColorPickerField
        label="Couleur"
        value={formData.color}
        onChange={(color) => setFormData(f => ({ ...f, color }))}
      />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Longueur (m)"
          type="number"
          value={formData.length}
          onChange={(v) => setFormData(f => ({ ...f, length: v }))}
          placeholder="12.5"
        />
        <TextField
          label="Virages"
          type="number"
          value={formData.corners}
          onChange={(v) => setFormData(f => ({ ...f, corners: v }))}
          placeholder="18"
        />
      </div>
    </FormModal>
  )
}
