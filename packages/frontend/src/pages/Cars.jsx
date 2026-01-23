import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TruckIcon,
  PencilIcon,
  BoltIcon,
  FireIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'
import ErrorMessage from '../components/ErrorMessage'
import { useFetch } from '../hooks/useFetch'
import {
  PageHeader,
  EmptyState,
  FormModal,
  TextField,
  PhotoUploadField,
  ColorPickerField,
  RangeField
} from '../components/crud'

const API_URL = import.meta.env.VITE_API_URL || ''
const PRIMARY_COLOR = '#22C55E'

export default function Cars() {
  const navigate = useNavigate()
  const { data: cars = [], loading, refetch } = useFetch('/api/cars')
  const [showForm, setShowForm] = useState(false)
  const [editingCar, setEditingCar] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [error, setError] = useState('')

  async function deleteCar(id) {
    try {
      await fetch(`${API_URL}/api/cars/${id}`, { method: 'DELETE' })
      refetch()
    } catch {
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 5000)
    }
  }

  function handleEdit(car) {
    setEditingCar(car)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingCar(null)
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Voitures"
        icon={<TruckIcon className="w-8 h-8" />}
        count={cars.length}
        countLabel={`voiture${cars.length > 1 ? 's' : ''} enregistrée${cars.length > 1 ? 's' : ''}`}
        onAdd={() => setShowForm(true)}
        addLabel="Ajouter une voiture"
        primaryColor={PRIMARY_COLOR}
        showViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {error && (
        <ErrorMessage type="error" message={error} onClose={() => setError('')} className="mb-4" />
      )}

      {cars.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} onEdit={() => handleEdit(car)} />
            ))}
          </div>
        ) : (
          <CarTable cars={cars} onEdit={handleEdit} onView={(car) => navigate(`/cars/${car.id}`)} />
        )
      ) : (
        <EmptyState
          icon={<TruckIcon className="w-8 h-8" />}
          title="Aucune voiture enregistrée"
          message="Ajoutez votre première voiture pour commencer"
          actionLabel="Ajouter la première voiture"
          onAction={() => setShowForm(true)}
          primaryColor={PRIMARY_COLOR}
        />
      )}

      {showForm && (
        <CarFormModal
          car={editingCar}
          onClose={handleFormClose}
          onDelete={editingCar ? () => deleteCar(editingCar.id) : undefined}
        />
      )}
    </div>
  )
}

function CarCard({ car, onClick, onEdit }) {
  const carColor = car.color || '#22C55E'

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all cursor-pointer"
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${carColor}10 0%, ${carColor}05 100%)`
      }}
    >
      {/* Racing stripe */}
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: carColor }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Photo/Icon */}
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: carColor }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${carColor} 0%, ${carColor}CC 100%)` }}
            >
              {car.img ? (
                <img src={car.img} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{car.brand.charAt(0)}</span>
              )}
            </div>
          </div>

          {car.year && (
            <div className="px-3 py-1 rounded-full text-sm font-bold bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white shadow-md">
              {car.year}
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-black text-xl tracking-tight text-gray-900 dark:text-white uppercase">{car.brand}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="w-8 h-8 rounded-lg bg-white/90 dark:bg-gray-700/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-600 hover:scale-110 transition-all flex items-center justify-center shadow-md"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="font-bold text-lg" style={{ color: carColor }}>{car.model}</p>
          <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: carColor }} />
        </div>
      </div>

      <div className="px-6 pb-6 space-y-3">
        <SpecBar icon={<BoltIcon className="w-4 h-4" />} label="Vitesse" value={car.maxSpeed} color="#22C55E" />
        <SpecBar icon={<FireIcon className="w-4 h-4" />} label="Freinage" value={car.brakeForce} color="#EF4444" />
        <SpecBar icon={<BeakerIcon className="w-4 h-4" />} label="Réservoir" value={(car.fuelCapacity / 150) * 100} color="#3B82F6" displayValue={car.fuelCapacity} />

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Courses</span>
            <span className="text-lg font-black" style={{ color: carColor }}>{car._count?.sessions || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpecBar({ icon, label, value, color, displayValue }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">{label}</span>
        </div>
        <span className="text-sm font-black" style={{ color }}>
          {displayValue ?? `${Math.round(value)}%`}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function CarTable({ cars, onEdit, onView }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Marque & Modèle</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Année</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vitesse</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Freinage</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Réservoir</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Courses</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {cars.map((car) => {
            const carColor = car.color || '#22C55E'
            return (
            <tr key={car.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => onView(car)}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${carColor} 0%, ${carColor}CC 100%)` }}
                  >
                    {car.img ? (
                      <img src={car.img} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
                    ) : (
                      car.brand.charAt(0)
                    )}
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">{car.brand} {car.model}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{car.year || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 w-20">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${car.maxSpeed}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{car.maxSpeed}%</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 w-20">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${car.brakeForce}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{car.brakeForce}%</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{car.fuelCapacity}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{car._count?.sessions || 0}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <button onClick={(e) => { e.stopPropagation(); onEdit(car) }} className="text-green-600 hover:text-green-400">
                  <PencilIcon className="w-5 h-5" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}

function CarFormModal({ car, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year || new Date().getFullYear(),
    color: car?.color || '#22C55E',
    maxSpeed: car?.maxSpeed || 100,
    brakeForce: car?.brakeForce || 50,
    fuelCapacity: car?.fuelCapacity || 100,
    img: car?.img || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const url = car ? `${API_URL}/api/cars/${car.id}` : `${API_URL}/api/cars`
      const res = await fetch(url, {
        method: car ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setSuccess('Voiture sauvegardée avec succès')
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
      title={car ? 'Modifier la voiture' : 'Nouvelle voiture'}
      icon={<TruckIcon className="w-5 h-5 text-green-500" />}
      onSubmit={handleSubmit}
      onDelete={onDelete ? handleDelete : undefined}
      isEditing={!!car}
      saving={saving}
      error={error}
      success={success}
      primaryColor={PRIMARY_COLOR}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Marque"
          value={formData.brand}
          onChange={(v) => setFormData(f => ({ ...f, brand: v }))}
          placeholder="Ferrari"
          required
        />
        <TextField
          label="Modèle"
          value={formData.model}
          onChange={(v) => setFormData(f => ({ ...f, model: v }))}
          placeholder="SF-23"
          required
        />
      </div>

      <TextField
        label="Année"
        type="number"
        value={formData.year}
        onChange={(v) => setFormData(f => ({ ...f, year: parseInt(v) || new Date().getFullYear() }))}
      />

      <PhotoUploadField
        label="Photo de la voiture"
        value={formData.img}
        onChange={(img) => setFormData(f => ({ ...f, img }))}
        shape="rect"
        primaryColor={PRIMARY_COLOR}
        onError={setError}
        uploadType="cars"
      />

      <ColorPickerField
        label="Couleur"
        value={formData.color}
        onChange={(color) => setFormData(f => ({ ...f, color }))}
      />

      <RangeField
        label="Vitesse Max"
        value={formData.maxSpeed}
        onChange={(v) => setFormData(f => ({ ...f, maxSpeed: v }))}
        color="#22C55E"
      />

      <RangeField
        label="Force de Freinage"
        value={formData.brakeForce}
        onChange={(v) => setFormData(f => ({ ...f, brakeForce: v }))}
        color="#EF4444"
      />

      <RangeField
        label="Capacité Réservoir"
        value={formData.fuelCapacity}
        onChange={(v) => setFormData(f => ({ ...f, fuelCapacity: v }))}
        min={50}
        max={150}
        unit=""
        color="#3B82F6"
      />
    </FormModal>
  )
}
