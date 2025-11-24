import { useState, useEffect } from 'react'
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  UserGroupIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline'
import { UserGroupIcon as UserGroupSolidIcon } from '@heroicons/react/24/solid'
import ImageCropper from '../components/ImageCropper'
import ErrorMessage from '../components/ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [error, setError] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    try {
      const res = await fetch(`${API_URL}/teams`)
      const data = await res.json()
      setTeams(data.data || [])
    } catch (error) {
      console.error('Failed to load teams:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteTeam(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette équipe ?')) return

    try {
      const res = await fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        await loadTeams()
      } else {
        setError(data.error || 'Erreur lors de la suppression')
        setTimeout(() => setError(''), 5000)
      }
    } catch (error) {
      console.error('Failed to delete team:', error)
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 5000)
    }
  }

  function handleEdit(team) {
    setEditingTeam(team)
    setShowForm(true)
  }

  function handleDelete(team) {
    deleteTeam(team.id)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingTeam(null)
    loadTeams()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Équipes</h1>
          <p className="text-gray-600 mt-1">{teams.length} équipe{teams.length > 1 ? 's' : ''} enregistrée{teams.length > 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`
                px-3 py-2 rounded-md transition-all flex items-center gap-2
                ${viewMode === 'grid' ? 'bg-white shadow text-orange-600' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <Squares2X2Icon className="w-5 h-5" />
              <span className="text-sm font-medium">Grille</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`
                px-3 py-2 rounded-md transition-all flex items-center gap-2
                ${viewMode === 'list' ? 'bg-white shadow text-orange-600' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <ListBulletIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Liste</span>
            </button>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Ajouter une équipe
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {/* Teams Display */}
      {teams.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onEdit={() => handleEdit(team)}
                onDelete={() => handleDelete(team)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Équipe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Couleur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pilotes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md overflow-hidden"
                          style={{
                            background: team.color ? `linear-gradient(135deg, ${team.color} 0%, ${team.color}CC 100%)` : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                          }}
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
                          <div
                            className="w-8 h-8 rounded-lg shadow-md border-2 border-white ring-1 ring-gray-200"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-sm text-gray-500 font-mono">{team.color}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {team._count?.drivers || 0} pilote{(team._count?.drivers || 0) > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(team)}
                        className="text-orange-600 hover:text-orange-900"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg mb-4">Aucune équipe enregistrée</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Ajouter la première équipe
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TeamForm
          team={editingTeam}
          onClose={handleFormClose}
          onDelete={editingTeam ? () => handleDelete(editingTeam) : undefined}
        />
      )}
    </div>
  )
}

function TeamCard({ team, onEdit, onDelete }) {
  const teamColor = team.color || '#f97316' // orange par défaut

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group bg-white"
      style={{
        background: `linear-gradient(135deg, ${teamColor}10 0%, ${teamColor}05 100%)`,
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${teamColor},
            ${teamColor} 10px,
            transparent 10px,
            transparent 20px
          )`
        }}
      />

      {/* Header avec logo */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Logo/Icon */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-xl blur-md opacity-50"
              style={{ backgroundColor: teamColor }}
            />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}CC 100%)`,
              }}
            >
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserGroupSolidIcon className="w-12 h-12 drop-shadow-lg" />
              )}
            </div>
          </div>

          {/* Color badge */}
          {team.color && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm shadow-md">
              <div
                className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-gray-300"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-xs font-mono font-bold text-gray-700">{team.color}</span>
            </div>
          )}
        </div>

        {/* Nom de l'équipe */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-black text-2xl tracking-tight text-gray-900 uppercase">
              {team.name}
            </h3>
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white hover:scale-110 transition-all duration-200 flex items-center justify-center shadow-md flex-shrink-0"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: teamColor }} />
        </div>
      </div>

      {/* Drivers section */}
      <div className="px-6 pb-6">
        <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5" style={{ color: teamColor }} />
              <span className="text-sm font-bold text-gray-700 uppercase">Pilotes</span>
            </div>
            <span className="text-2xl font-black" style={{ color: teamColor }}>
              {team._count?.drivers || 0}
            </span>
          </div>

          {/* Liste des pilotes */}
          {team.drivers && team.drivers.length > 0 ? (
            <div className="space-y-1">
              {team.drivers.slice(0, 3).map((driver) => (
                <div key={driver.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: teamColor }}
                  />
                  <span className="text-gray-700 font-medium">{driver.name}</span>
                  {driver.number && (
                    <span className="text-gray-400 text-xs">#{driver.number}</span>
                  )}
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

      {/* Racing stripe effect */}
      <div
        className="absolute top-0 left-0 w-1 h-full opacity-80"
        style={{ backgroundColor: teamColor }}
      />
    </div>
  )
}

function TeamForm({ team, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    name: team?.name || '',
    color: team?.color || '#f97316',
    logo: team?.logo || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [logoPreview, setLogoPreview] = useState(team?.logo || '')
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
    setFormData({ ...formData, logo: croppedImage })
    setLogoPreview(croppedImage)
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
      const url = team
        ? `${API_URL}/teams/${team.id}`
        : `${API_URL}/teams`

      const method = team ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setSuccess('Équipe sauvegardée avec succès')
        setTimeout(() => onClose(), 1500)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Failed to save team:', error)
      setError('Erreur de connexion au serveur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          {team ? 'Modifier l\'équipe' : 'Nouvelle équipe'}
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
              Nom de l'équipe *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Red Bull Racing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Couleur de l'équipe
            </label>
            <div className="flex gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-12 border rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
                placeholder="#f97316"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              La couleur sera utilisée pour identifier l'équipe dans l'application
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo de l'équipe
            </label>

            {/* Logo preview */}
            {logoPreview && (
              <div className="mb-3 flex justify-center">
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Aperçu"
                    className="w-32 h-32 rounded-xl object-cover ring-4 ring-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, logo: '' })
                      setLogoPreview('')
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
                <div className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 transition-colors text-center">
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
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

            {team && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onDelete()
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Supprimer l'équipe
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
