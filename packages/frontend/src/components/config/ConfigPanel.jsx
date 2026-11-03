import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ControllerSlot from './ControllerSlot'

export default function ConfigPanel({ configs, drivers, cars, onConfigChange, disabled }) {
  const { t } = useTranslation('race')
  const controllers = [1, 2, 3, 4, 5, 6]

  // Collect all used driver and car IDs
  const { usedDriverIds, usedCarIds } = useMemo(() => {
    const driverIds = []
    const carIds = []
    controllers.forEach((c) => {
      const config = configs?.[c]
      if (config?.driverId) driverIds.push(config.driverId)
      if (config?.carId) carIds.push(config.carId)
    })
    return { usedDriverIds: driverIds, usedCarIds: carIds }
  }, [configs])

  return (
    <div data-testid="controller-config-panel" className="bg-gray-50 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('controllerConfig.title')}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {controllers.map((controller) => (
          <ControllerSlot
            key={controller}
            controller={controller}
            config={configs?.[controller]}
            drivers={drivers}
            cars={cars}
            onChange={onConfigChange}
            disabled={disabled}
            usedDriverIds={usedDriverIds}
            usedCarIds={usedCarIds}
          />
        ))}
      </div>
    </div>
  )
}
