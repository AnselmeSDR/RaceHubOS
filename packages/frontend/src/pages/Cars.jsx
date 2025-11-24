import { useState, useEffect } from 'react'
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  BoltIcon,
  FireIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'
import { BoltIcon as BoltSolidIcon } from '@heroicons/react/24/solid'
import ImageCropper from '../components/ImageCropper'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Cars() {
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCar, setEditingCar] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

  useEffect(() => {
    loadCars()
  }, [])

  async function loadCars() {
    try {
      const res = await fetch(`${API_URL}/cars`)
      const data = await res.json()
      setCars(data.data || [])
    } catch (error) {
      console.error('Failed to load cars:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteCar(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette voiture ?')) return

    try {
      await fetch(`${API_URL}/cars/${id}`, { method: 'DELETE' })
      await loadCars()
    } catch (error) {
      console.error('Failed to delete car:', error)
      alert('Erreur lors de la suppression')
    }
  }

  function handleEdit(car) {
    setEditingCar(car)
    setShowForm(true)
  }

  function handleDelete(car) {
    deleteCar(car.id)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingCar(null)
    loadCars()
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voitures</h1>
          <p className="text-gray-600 mt-1">{cars.length} voiture{cars.length > 1 ? 's' : ''} enregistrée{cars.length > 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`
                px-3 py-2 rounded-md transition-all flex items-center gap-2
                ${viewMode === 'grid' ? 'bg-white shadow text-green-600' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <Squares2X2Icon className="w-5 h-5" />
              <span className="text-sm font-medium">Grille</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`
                px-3 py-2 rounded-md transition-all flex items-center gap-2
                ${viewMode === 'list' ? 'bg-white shadow text-green-600' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <ListBulletIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Liste</span>
            </button>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Ajouter une voiture
          </button>
        </div>
      </div>

      {/* Cars Display */}
      {cars.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => (
              <CarCard
                key={car.id}
                car={car}
                onEdit={() => handleEdit(car)}
                onDelete={() => handleDelete(car)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marque & Modèle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Année
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vitesse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Freinage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Réservoir
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Courses
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cars.map((car) => (
                  <tr key={car.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                          {car.brand.charAt(0)}
                        </div>
                        <div className="font-medium text-gray-900">{car.brand} {car.model}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {car.year || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${car.maxSpeed}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">{car.maxSpeed}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${car.brakeForce}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">{car.brakeForce}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {car.fuelCapacity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {car._count?.sessions || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(car)}
                        className="text-green-600 hover:text-green-900"
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
          <p className="text-gray-500 text-lg mb-4">Aucune voiture enregistrée</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Ajouter la première voiture
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <CarForm
          car={editingCar}
          onClose={handleFormClose}
          onDelete={editingCar ? () => handleDelete(editingCar) : undefined}
        />
      )}
    </div>
  )
}

function CarCard({ car, onEdit, onDelete }) {
  // Utilise la couleur de la voiture ou une couleur par défaut
  const carColor = car.color || '#3b82f6'

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group bg-white"
      style={{
        background: `linear-gradient(135deg, ${carColor}10 0%, ${carColor}05 100%)`,
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${carColor},
            ${carColor} 10px,
            transparent 10px,
            transparent 20px
          )`
        }}
      />

      {/* Header avec photo */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {/* Photo/Icon */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-xl blur-md opacity-50"
              style={{ backgroundColor: carColor }}
            />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${carColor} 0%, ${carColor}CC 100%)`,
              }}
            >
              {car.photo ? (
                <img
                  src={car.photo}
                  alt={`${car.brand} ${car.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="drop-shadow-lg">{car.brand.charAt(0)}</span>
              )}
            </div>
          </div>

          {/* Year badge */}
          {car.year && (
            <div className="px-3 py-1 rounded-full text-sm font-bold bg-white/80 backdrop-blur-sm text-gray-900 shadow-md">
              {car.year}
            </div>
          )}
        </div>

        {/* Nom de la voiture */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-black text-xl tracking-tight text-gray-900 uppercase">
              {car.brand}
            </h3>
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white hover:scale-110 transition-all duration-200 flex items-center justify-center shadow-md flex-shrink-0"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="font-bold text-lg" style={{ color: carColor }}>
            {car.model}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-16 rounded-full" style={{ backgroundColor: carColor }} />
            <div
              className="w-6 h-6 rounded-full ring-2 ring-white shadow-md"
              style={{ backgroundColor: carColor }}
              title={carColor}
            />
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="px-6 pb-6">
        <div className="space-y-3">
          {/* Vitesse */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BoltIcon className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-gray-600 uppercase">Vitesse</span>
              </div>
              <span className="text-sm font-black text-green-600">{car.maxSpeed}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${car.maxSpeed}%` }}
              />
            </div>
          </div>

          {/* Freinage */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <FireIcon className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-gray-600 uppercase">Freinage</span>
              </div>
              <span className="text-sm font-black text-red-600">{car.brakeForce}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${car.brakeForce}%` }}
              />
            </div>
          </div>

          {/* Réservoir */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BeakerIcon className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-600 uppercase">Réservoir</span>
              </div>
              <span className="text-sm font-black text-blue-600">{car.fuelCapacity}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(car.fuelCapacity / 150) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats footer */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Courses</span>
            <span className="text-lg font-black" style={{ color: carColor }}>
              {car._count?.sessions || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Racing stripe effect */}
      <div
        className="absolute top-0 left-0 w-1 h-full opacity-80"
        style={{ backgroundColor: carColor }}
      />
    </div>
  )
}

function CarForm({ car, onClose, onDelete }) {
  const [formData, setFormData] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year || new Date().getFullYear(),
    color: car?.color || '#3B82F6',
    maxSpeed: car?.maxSpeed || 100,
    brakeForce: car?.brakeForce || 50,
    fuelCapacity: car?.fuelCapacity || 100,
    photo: car?.photo || '',
  })
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(car?.photo || '')
  const [imageToCrop, setImageToCrop] = useState(null)
  const [showCropper, setShowCropper] = useState(false)

  // Handle file upload - Ouvre le cropper
  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (file) {
      // Check file type only (no size limit!)
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image.')
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

    try {
      const url = car
        ? `${API_URL}/cars/${car.id}`
        : `${API_URL}/cars`

      const method = car ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        onClose()
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Failed to save car:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          {car ? 'Modifier la voiture' : 'Nouvelle voiture'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marque *
              </label>
              <input
                type="text"
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ferrari"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modèle *
              </label>
              <input
                type="text"
                required
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="SF-23"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Année
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="1900"
              max="2100"
            />
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
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo de la voiture
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
                <div className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors text-center">
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
              Vitesse Max ({formData.maxSpeed}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.maxSpeed}
              onChange={(e) => setFormData({ ...formData, maxSpeed: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Force de Freinage ({formData.brakeForce}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.brakeForce}
              onChange={(e) => setFormData({ ...formData, brakeForce: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacité Réservoir ({formData.fuelCapacity})
            </label>
            <input
              type="range"
              min="50"
              max="150"
              value={formData.fuelCapacity}
              onChange={(e) => setFormData({ ...formData, fuelCapacity: parseInt(e.target.value) })}
              className="w-full"
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
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

            {car && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onDelete()
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <TrashIcon className="w-4 h-4" />
                Supprimer la voiture
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
