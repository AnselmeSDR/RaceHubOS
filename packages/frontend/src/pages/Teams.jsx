import { useState } from 'react'
import { UserGroupIcon, PencilIcon } from '@heroicons/react/24/outline'
import { UserGroupIcon as UserGroupSolidIcon } from '@heroicons/react/24/solid'
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
const PRIMARY_COLOR = '#F97316'

export default function Teams() {
  const { data: teams = [], loading, refetch } = useFetch('/api/teams')
  const [showForm, setShowForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [error, setError] = useState('')

  async function deleteTeam(id) {
    try {
      const res = await fetch(`${API_URL}/api/teams/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        refetch()
      } else {
        setError(data.error || 'Erreur lors de la suppression')
        setTimeout(() => setError(''), 5000)
      }
    } catch {
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 5000)
    }
  }

  function handleEdit(team) {
    setEditingTeam(team)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingTeam(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Équipes"
        icon={<UserGroupIcon className="w-8 h-8" />}
        count={teams.length}
        countLabel={`équipe${teams.length > 1 ? 's' : ''} enregistrée${teams.length > 1 ? 's' : ''}`}
        onAdd={() => setShowForm(true)}
        addLabel="Ajouter une équipe"
        primaryColor={PRIMARY_COLOR}
        showViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {teams.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} onEdit={() => handleEdit(team)} />
            ))}
          </div>
        ) : (
          <TeamTable teams={teams} onEdit={handleEdit} />
        )
      ) : (
        <EmptyState
          icon={<UserGroupIcon className="w-8 h-8" />}
          title="Aucune équipe enregistrée"
          message="Ajoutez votre première équipe pour commencer"
          actionLabel="Ajouter la première équipe"
          onAction={() => setShowForm(true)}
          primaryColor={PRIMARY_COLOR}
        />
      )}

      {showForm && (
        <TeamFormModal
          team={editingTeam}
          onClose={handleFormClose}
          onDelete={editingTeam ? () => deleteTeam(editingTeam.id) : undefined}
        />
      )}
    </div>
  )
}

function TeamCard({ team, onEdit }) {
  const teamColor = team.color || '#F97316'

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all cursor-pointer"
      onClick={onEdit}
      style={{
        background: `linear-gradient(135deg, ${teamColor}10 0%, ${teamColor}05 100%)`
      }}
    >
      {/* Racing stripe */}
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: teamColor }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Logo/Icon */}
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: teamColor }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}CC 100%)` }}
            >
              {team.logo ? (
                <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
              ) : (
                <UserGroupSolidIcon className="w-12 h-12 drop-shadow-lg" />
              )}
            </div>
          </div>

          {team.color && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 shadow-md">
              <div className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-gray-300" style={{ backgroundColor: team.color }} />
              <span className="text-xs font-mono font-bold text-gray-700">{team.color}</span>
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-black text-2xl tracking-tight text-gray-900 uppercase">{team.name}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="w-8 h-8 rounded-lg bg-white/90 text-gray-700 hover:bg-white hover:scale-110 transition-all flex items-center justify-center shadow-md"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: teamColor }} />
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-white/50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" style={{ color: teamColor }} />
              <span className="text-sm font-bold text-gray-700 uppercase">Pilotes</span>
            </div>
            <span className="text-2xl font-black" style={{ color: teamColor }}>
              {team._count?.drivers || 0}
            </span>
          </div>

          {team.drivers && team.drivers.length > 0 ? (
            <div className="space-y-1">
              {team.drivers.slice(0, 3).map((driver) => (
                <div key={driver.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }} />
                  <span className="text-gray-700 font-medium">{driver.name}</span>
                  {driver.number && <span className="text-gray-400 text-xs">#{driver.number}</span>}
                </div>
              ))}
              {team.drivers.length > 3 && (
                <div className="text-xs text-gray-500 italic mt-2">
                  +{team.drivers.length - 3} autre{team.drivers.length - 3 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">Aucun pilote</div>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamTable({ teams, onEdit }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Équipe</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Couleur</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pilotes</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {teams.map((team) => (
            <tr key={team.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${team.color || '#F97316'} 0%, ${team.color || '#F97316'}CC 100%)` }}
                  >
                    {team.logo ? (
                      <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserGroupSolidIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="font-medium text-gray-900">{team.name}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {team.color ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg shadow-md border-2 border-white ring-1 ring-gray-200" style={{ backgroundColor: team.color }} />
                    <span className="text-sm text-gray-500 font-mono">{team.color}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {team._count?.drivers || 0} pilote{(team._count?.drivers || 0) > 1 ? 's' : ''}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <button onClick={() => onEdit(team)} className="text-orange-600 hover:text-orange-900">
                  <PencilIcon className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamFormModal({ team, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    name: team?.name || '',
    color: team?.color || '#F97316',
    logo: team?.logo || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = team ? `${API_URL}/api/teams/${team.id}` : `${API_URL}/api/teams`
      const res = await fetch(url, {
        method: team ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setSuccess('Équipe sauvegardée avec succès')
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
      title={team ? "Modifier l'équipe" : 'Nouvelle équipe'}
      icon={<UserGroupIcon className="w-5 h-5 text-orange-500" />}
      onSubmit={handleSubmit}
      onDelete={onDelete ? handleDelete : undefined}
      isEditing={!!team}
      saving={saving}
      error={error}
      success={success}
      primaryColor={PRIMARY_COLOR}
    >
      <TextField
        label="Nom de l'équipe"
        value={formData.name}
        onChange={(v) => setFormData(f => ({ ...f, name: v }))}
        placeholder="Red Bull Racing"
        required
      />

      <PhotoUploadField
        label="Logo de l'équipe"
        value={formData.logo}
        onChange={(logo) => setFormData(f => ({ ...f, logo }))}
        shape="rect"
        primaryColor={PRIMARY_COLOR}
        onError={setError}
        uploadType="teams"
      />

      <ColorPickerField
        label="Couleur de l'équipe"
        value={formData.color}
        onChange={(color) => setFormData(f => ({ ...f, color }))}
      />
    </FormModal>
  )
}
