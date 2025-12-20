import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const CONTROLLER_COLORS = {
  1: 'bg-red-500',
  2: 'bg-blue-500',
  3: 'bg-yellow-500',
  4: 'bg-green-500',
  5: 'bg-purple-500',
  6: 'bg-orange-500',
}

export default function ControllerSlot({
  controller,
  config,
  drivers,
  cars,
  onChange,
  disabled,
  usedDriverIds = [],
  usedCarIds = []
}) {
  const isConfigured = config?.driverId && config?.carId
  const selectedDriver = drivers?.find(d => d.id === config?.driverId)
  const selectedCar = cars?.find(c => c.id === config?.carId)

  // Filter out drivers/cars already used by other controllers
  const availableDrivers = drivers?.filter(d =>
    d.id === config?.driverId || !usedDriverIds.includes(d.id)
  ) || []
  const availableCars = cars?.filter(c =>
    c.id === config?.carId || !usedCarIds.includes(c.id)
  ) || []

  function handleDriverChange(e) {
    onChange(controller, {
      driverId: e.target.value || null,
      carId: config?.carId || null,
    })
  }

  function handleCarChange(e) {
    onChange(controller, {
      driverId: config?.driverId || null,
      carId: e.target.value || null,
    })
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${
        isConfigured
          ? 'bg-white border-gray-200'
          : 'bg-yellow-50 border-yellow-300'
      }`}
    >
      {/* Header with controller number */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              CONTROLLER_COLORS[controller] || 'bg-gray-500'
            }`}
          >
            {controller}
          </div>
          <span className="font-medium text-gray-700">Controller {controller}</span>
        </div>
        {!isConfigured && (
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
        )}
      </div>

      {/* Photos row */}
      {(selectedDriver?.photoUrl || selectedCar?.photoUrl) && (
        <div className="flex items-center gap-2 mb-3">
          {selectedDriver?.photoUrl && (
            <img
              src={selectedDriver.photoUrl}
              alt={selectedDriver.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
            />
          )}
          {selectedCar?.photoUrl && (
            <img
              src={selectedCar.photoUrl}
              alt={`${selectedCar.brand} ${selectedCar.model}`}
              className="w-10 h-10 rounded object-cover border-2 border-gray-200"
            />
          )}
        </div>
      )}

      {/* Driver select */}
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Driver
        </label>
        <select
          value={config?.driverId || ''}
          onChange={handleDriverChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select driver...</option>
          {availableDrivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </div>

      {/* Car select */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Car
        </label>
        <select
          value={config?.carId || ''}
          onChange={handleCarChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select car...</option>
          {availableCars.map((car) => (
            <option key={car.id} value={car.id}>
              {car.brand} {car.model}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
