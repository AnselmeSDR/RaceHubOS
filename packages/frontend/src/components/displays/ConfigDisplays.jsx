import { useTranslation } from 'react-i18next'
import ControllerConfigSection from '@/components/race/freePractice/ControllerConfigSection'
import ConfigStatus from '@/components/config/ConfigStatus'
import SectionHeader from './SectionHeader'
import LoadingState from './LoadingState'

export default function ConfigDisplays({ drivers, cars, loading }) {
  const { t } = useTranslation('displays')

  if (loading) return <LoadingState />

  const demoConfigs = drivers.slice(0, 6).map((driver, idx) => ({
    controller: String(idx + 1),
    driver: idx < 3 ? driver : null,
    car: idx < 3 ? cars[idx] : null,
    driverId: idx < 3 ? driver.id : null,
    carId: idx < 3 ? cars[idx]?.id : null,
  }))

  return (
    <>
      {/* ConfigStatus */}
      <section>
        <SectionHeader
          title={t('config.configStatus.title')}
          description={t('config.configStatus.description')}
          componentName="ConfigStatus"
          code="<ConfigStatus />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {t('config.configStatus.incomplete', { count: 3 })}
            </p>
            <ConfigStatus unconfiguredCount={3} unconfiguredSlots={[4, 5, 6]} isComplete={false} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('config.configStatus.complete')}</p>
            <ConfigStatus unconfiguredCount={0} unconfiguredSlots={[]} isComplete={true} />
          </div>
        </div>
      </section>

      {/* ControllerConfigSection */}
      <section>
        <SectionHeader
          title={t('config.controllerConfigSection.title')}
          description={t('config.controllerConfigSection.description')}
          componentName="ControllerConfigSection"
          code="<ControllerConfigSection />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <ControllerConfigSection
            expanded={true}
            onToggle={() => {}}
            configs={demoConfigs}
            drivers={drivers}
            cars={cars}
            onConfigChange={() => {}}
            isComplete={false}
            unconfiguredSlots={[4, 5, 6]}
          />
        </div>
      </section>
    </>
  )
}
