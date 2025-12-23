import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrophyIcon,
  MapPinIcon,
  ChevronRightIcon,
  XMarkIcon,
  FlagIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { useFetch } from '../hooks/useFetch'
import {
  PageHeader,
  EmptyState,
  FormModal,
  TextField,
  SelectField
} from '../components/crud'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const PRIMARY_COLOR = '#EAB308'

export default function Championships() {
  const navigate = useNavigate()
  const { data: championships = [], loading, refetch } = useFetch('/api/championships')
  const { data: tracks = [] } = useFetch('/api/tracks')
  const [showForm, setShowForm] = useState(false)

  async function deleteChampionship(id, e) {
    e.stopPropagation()
    try {
      await fetch(`${API_URL}/api/championships/${id}`, { method: 'DELETE' })
      refetch()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  function handleFormClose() {
    setShowForm(false)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Championnats"
        icon={<TrophyIcon className="w-8 h-8" />}
        count={championships.length}
        countLabel={`championnat${championships.length > 1 ? 's' : ''}`}
        onAdd={() => setShowForm(true)}
        addLabel="Nouveau championnat"
        primaryColor={PRIMARY_COLOR}
      />

      {championships.length === 0 ? (
        <EmptyState
          icon={<TrophyIcon className="w-8 h-8" />}
          title="Aucun championnat"
          message="Créez votre premier championnat"
          actionLabel="Créer un championnat"
          onAction={() => setShowForm(true)}
          primaryColor={PRIMARY_COLOR}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {championships.map(champ => (
            <ChampionshipCard
              key={champ.id}
              championship={champ}
              track={tracks.find(t => t.id === champ.trackId)}
              onClick={() => navigate(`/championships/${champ.id}`)}
              onDelete={(e) => deleteChampionship(champ.id, e)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ChampionshipFormModal
          tracks={tracks}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}

function ChampionshipCard({ championship, track, onClick, onDelete }) {
  const qualifCount = championship.sessions?.filter(s => s.type === 'qualif').length || 0
  const raceCount = championship.sessions?.filter(s => s.type === 'race').length || 0

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrophyIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 group-hover:text-yellow-600 transition-colors">
                {championship.name}
              </h3>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPinIcon className="w-4 h-4" />
                {track?.name || 'Circuit non défini'}
              </div>
            </div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <ClockIcon className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600">{qualifCount} qualif{qualifCount > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <FlagIcon className="w-4 h-4 text-green-500" />
            <span className="text-gray-600">{raceCount} course{raceCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            championship.status === 'active' ? 'bg-green-100 text-green-700' :
            championship.status === 'finished' ? 'bg-gray-100 text-gray-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {championship.status === 'active' ? 'En cours' :
             championship.status === 'finished' ? 'Terminé' : 'Planifié'}
          </span>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChampionshipFormModal({ tracks, onClose }) {
  const [formData, setFormData] = useState({ name: '', trackId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    if (!formData.name || !formData.trackId) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/championships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          trackId: formData.trackId,
          season: new Date().getFullYear().toString(),
          pointsSystem: '{}'
        })
      })
      if (res.ok) {
        setSuccess('Championnat créé avec succès')
        setTimeout(() => onClose(), 1500)
      } else {
        setError('Erreur lors de la création')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  const trackOptions = tracks.map(t => ({ value: t.id, label: t.name }))

  return (
    <FormModal
      open
      onClose={onClose}
      title="Nouveau championnat"
      icon={<TrophyIcon className="w-5 h-5 text-yellow-500" />}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
      success={success}
      primaryColor={PRIMARY_COLOR}
      saveLabel="Créer"
    >
      <TextField
        label="Nom du championnat"
        value={formData.name}
        onChange={(v) => setFormData(f => ({ ...f, name: v }))}
        placeholder="Championnat 2024"
        required
      />

      <SelectField
        label="Circuit"
        value={formData.trackId}
        onChange={(v) => setFormData(f => ({ ...f, trackId: v }))}
        options={trackOptions}
        placeholder="Sélectionner un circuit..."
        required
      />
    </FormModal>
  )
}
