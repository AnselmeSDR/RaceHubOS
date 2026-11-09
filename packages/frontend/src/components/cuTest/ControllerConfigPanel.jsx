import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { CONTROLLER_COLORS } from '@/constants'

const CONTROLLERS = [1, 2, 3, 4, 5, 6, 7, 8]
const SELECT =
  'w-full px-2 py-1 text-sm border dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-600 dark:text-white'

// Who drives what on each of the eight controllers
export default function ControllerConfigPanel({ config, drivers, cars, onChange }) {
  const { t } = useTranslation('test')
  return (
    <div data-testid="cu-test-config" className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
        <User className="w-5 h-5" />
        {t('config.title')}
      </h3>
      <div className="grid grid-cols-4 gap-3">
        {CONTROLLERS.map((controller) => {
          const assigned = config[controller] || {}
          const label = t('config.controller', { number: controller })
          return (
            <div key={controller} className="border dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500"
                  style={{ backgroundColor: CONTROLLER_COLORS[controller] }}
                />
                <span className="font-bold text-sm text-gray-900 dark:text-white">{label}</span>
              </div>
              <div className="space-y-2">
                <select
                  aria-label={`${label} ${t('config.driverPlaceholder')}`}
                  value={assigned.driverId || ''}
                  onChange={(e) => onChange(controller, 'driverId', e.target.value)}
                  className={SELECT}
                >
                  <option value="">{t('config.driverPlaceholder')}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.number} {d.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`${label} ${t('config.carPlaceholder')}`}
                  value={assigned.carId || ''}
                  onChange={(e) => onChange(controller, 'carId', e.target.value)}
                  className={SELECT}
                >
                  <option value="">{t('config.carPlaceholder')}</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brand} {c.model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {t('config.autoSaved', { driverCount: drivers.length, carCount: cars.length })}
      </p>
    </div>
  )
}
