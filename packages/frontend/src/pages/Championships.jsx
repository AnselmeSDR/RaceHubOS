import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrophyIcon,
  MapPinIcon,
  TrashIcon,
  FlagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useFetch } from '../hooks/useFetch'
import {
  PageHeader,
  EmptyState,
  FormModal,
  TextField,
  SelectField,
} from '../components/crud'
import { ConfirmModal } from '../components/ui/Modal'

const API_URL = import.meta.env.VITE_API_URL || ''
const PRIMARY_COLOR = '#EAB308'

export default function Championships() {
  const navigate = useNavigate()
  const { data: championships = [], loading, refetch } = useFetch('/api/championships')
  const { data: tracks = [] } = useFetch('/api/tracks')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === championships.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(championships.map(c => c.id)))
    }
  }

  async function confirmDelete() {
    try {
      await Promise.all(
        [...selected].map(id =>
          fetch(`${API_URL}/api/championships/${id}`, { method: 'DELETE' })
        )
      )
      setSelected(new Set())
      refetch()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  function handleFormClose() {
    setShowForm(false)
    refetch()
  }

  function getStatusBadge(status) {
    const styles = {
      active: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
      finished: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      planned: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
    }
    const labels = { active: 'En cours', finished: 'Terminé', planned: 'Planifié' }
    const key = status || 'planned'
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[key] || styles.planned}`}>
        {labels[key] || labels.planned}
      </span>
    )
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

      {/* Selection actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Supprimer
          </button>
        </div>
      )}

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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === championships.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Circuit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Qualifs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Courses</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {championships.map(champ => {
                const track = tracks.find(t => t.id === champ.trackId)
                const qualifCount = champ.sessions?.filter(s => s.type === 'qualif').length || 0
                const raceCount = champ.sessions?.filter(s => s.type === 'race').length || 0
                const isSelected = selected.has(champ.id)

                return (
                  <tr
                    key={champ.id}
                    onClick={() => navigate(`/championships/${champ.id}`)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-yellow-50 dark:bg-yellow-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(champ.id)}
                        className="w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrophyIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">{champ.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                        <MapPinIcon className="w-4 h-4" />
                        {track?.name || 'Non défini'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                        <ClockIcon className="w-4 h-4 text-blue-500" />
                        {qualifCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                        <FlagIcon className="w-4 h-4 text-green-500" />
                        {raceCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(champ.status)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ChampionshipFormModal
          tracks={tracks}
          onClose={handleFormClose}
        />
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Supprimer les championnats"
        message={`${selected.size} championnat${selected.size > 1 ? 's' : ''} sera${selected.size > 1 ? 'ont' : ''} supprimé${selected.size > 1 ? 's' : ''}. Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
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
