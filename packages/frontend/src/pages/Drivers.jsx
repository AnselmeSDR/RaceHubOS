import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  TrophyIcon,
  FlagIcon,
  ChartBarIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import { TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import { DriverListItem } from '../components/DriverDisplays'
import ErrorMessage from '../components/ErrorMessage'
import { useFetch } from '../hooks/useFetch'
import {
  PageHeader,
  EmptyState,
  FormModal,
  TextField,
  SelectField,
  PhotoUploadField,
  ColorPickerField
} from '../components/crud'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const PRIMARY_COLOR = '#3B82F6'

export default function Drivers() {
  const navigate = useNavigate()
  const { data: drivers = [], loading, refetch } = useFetch('/api/drivers')
  const { data: teams = [] } = useFetch('/api/teams')

  const [showForm, setShowForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [error, setError] = useState('')

  async function deleteDriver(id) {
    try {
      await fetch(`${API_URL}/api/drivers/${id}`, { method: 'DELETE' })
      refetch()
    } catch {
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 5000)
    }
  }

  function handleEdit(driver) {
    setEditingDriver(driver)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingDriver(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Pilotes"
        icon={<UserIcon className="w-8 h-8" />}
        count={drivers.length}
        countLabel={`pilote${drivers.length > 1 ? 's' : ''} enregistré${drivers.length > 1 ? 's' : ''}`}
        onAdd={() => setShowForm(true)}
        addLabel="Ajouter un pilote"
        primaryColor={PRIMARY_COLOR}
        showViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {drivers.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onEdit={() => handleEdit(driver)}
                onClick={() => navigate(`/drivers/${driver.id}`)}
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
                showStats
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<UserIcon className="w-8 h-8" />}
          title="Aucun pilote enregistré"
          message="Ajoutez votre premier pilote pour commencer"
          actionLabel="Ajouter le premier pilote"
          onAction={() => setShowForm(true)}
          primaryColor={PRIMARY_COLOR}
        />
      )}

      {showForm && (
        <DriverFormModal
          driver={editingDriver}
          teams={teams}
          onClose={handleFormClose}
          onDelete={editingDriver ? () => deleteDriver(editingDriver.id) : undefined}
        />
      )}
    </div>
  )
}

function DriverCard({ driver, onEdit, onClick }) {
  const wins = driver.wins || 0
  const podiums = driver.podiums || 0

  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${driver.color}15 0%, ${driver.color}05 100%)`,
        boxShadow: `0 4px 6px rgba(0,0,0,0.1), 0 0 20px ${driver.color}40`
      }}
    >
      {/* Racing stripe */}
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: driver.color }} />

      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${driver.color}, ${driver.color} 10px, transparent 10px, transparent 20px)`
        }}
      />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Avatar */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-md opacity-50" style={{ backgroundColor: driver.color }} />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)` }}
            >
              {driver.photo ? (
                <img src={driver.photo} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{driver.name.charAt(0)}</span>
              )}
            </div>
            {wins > 0 && (
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center ring-2 ring-white shadow-lg">
                <TrophySolidIcon className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {driver.number && (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center shadow-lg overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}DD 100%)` }}
              >
                <span className="text-4xl font-black text-white drop-shadow-lg">{driver.number}</span>
              </div>
            )}
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

        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-black text-2xl tracking-tight" style={{ color: driver.color }}>
              {driver.name.toUpperCase()}
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="w-8 h-8 rounded-lg bg-white/90 text-gray-700 hover:bg-white hover:scale-110 transition-all flex items-center justify-center shadow-md flex-shrink-0"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1 w-16 rounded-full" style={{ backgroundColor: driver.color }} />
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <StatBadge icon={<FlagIcon className="w-4 h-4" />} label="Courses" value={driver._count?.sessions || 0} color={driver.color} />
          <StatBadge icon={<TrophyIcon className="w-4 h-4" />} label="Podiums" value={podiums} color={driver.color} highlight={podiums > 0} />
          <StatBadge icon={<ChartBarIcon className="w-4 h-4" />} label="Tours" value={driver._count?.laps || 0} color={driver.color} />
        </div>

        {driver.bestLap && (
          <div className="mt-3 p-3 rounded-lg bg-white/80 border-2" style={{ borderColor: `${driver.color}40` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 uppercase">Meilleur Tour</span>
              <span className="text-lg font-black tabular-nums" style={{ color: driver.color }}>
                {(driver.bestLap / 1000).toFixed(3)}s
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBadge({ icon, label, value, color, highlight }) {
  return (
    <div className={`p-2 rounded-lg text-center ${highlight ? 'bg-yellow-50 ring-2 ring-yellow-400' : 'bg-white/60'}`}>
      <div className="flex items-center justify-center mb-1" style={{ color: highlight ? '#EAB308' : color }}>
        {icon}
      </div>
      <div className="text-xs font-medium text-gray-600 mb-0.5 uppercase">{label}</div>
      <div className="text-lg font-black tabular-nums" style={{ color: highlight ? '#EAB308' : color }}>
        {value}
      </div>
    </div>
  )
}

function DriverFormModal({ driver, teams, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    name: driver?.name || '',
    number: driver?.number || '',
    email: driver?.email || '',
    photo: driver?.photo || '',
    color: driver?.color || '#3B82F6',
    teamId: driver?.teamId || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = driver ? `${API_URL}/api/drivers/${driver.id}` : `${API_URL}/api/drivers`
      const res = await fetch(url, {
        method: driver ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setSuccess('Pilote sauvegardé avec succès')
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

  const teamOptions = teams.map(t => ({ value: t.id, label: t.name }))

  return (
    <FormModal
      open
      onClose={onClose}
      title={driver ? 'Modifier le pilote' : 'Nouveau pilote'}
      icon={<UserIcon className="w-5 h-5 text-blue-500" />}
      onSubmit={handleSubmit}
      onDelete={onDelete ? handleDelete : undefined}
      isEditing={!!driver}
      saving={saving}
      error={error}
      success={success}
      primaryColor={PRIMARY_COLOR}
    >
      <TextField
        label="Nom"
        value={formData.name}
        onChange={(v) => setFormData(f => ({ ...f, name: v }))}
        placeholder="Lewis Hamilton"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Numéro (1-999)"
          type="number"
          value={formData.number}
          onChange={(v) => setFormData(f => ({ ...f, number: v ? parseInt(v) : '' }))}
          placeholder="44"
        />
        <TextField
          label="Email"
          type="email"
          value={formData.email}
          onChange={(v) => setFormData(f => ({ ...f, email: v }))}
          placeholder="lewis@example.com"
        />
      </div>

      <PhotoUploadField
        label="Photo de profil"
        value={formData.photo}
        onChange={(photo) => setFormData(f => ({ ...f, photo }))}
        shape="round"
        primaryColor={PRIMARY_COLOR}
        onError={setError}
        uploadType="drivers"
      />

      <ColorPickerField
        label="Couleur"
        value={formData.color}
        onChange={(color) => setFormData(f => ({ ...f, color }))}
      />

      <SelectField
        label="Équipe"
        value={formData.teamId}
        onChange={(v) => setFormData(f => ({ ...f, teamId: v }))}
        options={teamOptions}
        placeholder="Aucune équipe"
      />
    </FormModal>
  )
}
