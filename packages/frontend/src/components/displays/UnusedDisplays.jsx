import { useTranslation } from 'react-i18next'
import { DriverBadge, DriverGridPosition, DriverStanding, DriverSelectCard } from '@/components/DriverDisplays'
import EntityCard, { StatBadge } from '@/components/crud/EntityCard'
import { COMPONENT_USAGE } from './componentUsage'
import SectionHeader from './SectionHeader'
import LoadingState from './LoadingState'

export default function UnusedDisplays({ drivers, loading }) {
  const { t } = useTranslation('displays')

  if (loading) return <LoadingState />

  const unusedComponents = Object.entries(COMPONENT_USAGE)
    .filter(([, usage]) => usage.length === 0)
    .map(([name]) => name)

  return (
    <>
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-2">
          {t('unused.banner.title', { count: unusedComponents.length })}
        </h2>
        <p className="text-orange-700 dark:text-orange-400 text-sm mb-4">{t('unused.banner.description')}</p>
        <div className="flex flex-wrap gap-2">
          {unusedComponents.map((name) => (
            <span
              key={name}
              className="px-3 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 rounded-full text-sm font-medium"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* DriverBadge - Unused in pages */}
      <section>
        <SectionHeader
          title={t('unused.driverBadge.title')}
          description={t('unused.driverBadge.description')}
          componentName="DriverBadge"
          code="<DriverBadge />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex flex-wrap gap-3">
            {drivers.slice(0, 4).map((driver) => (
              <DriverBadge key={driver.id} driver={driver} size="md" showName={true} />
            ))}
          </div>
        </div>
      </section>

      {/* DriverGridPosition - Unused */}
      <section>
        <SectionHeader
          title={t('unused.driverGridPosition.title')}
          description={t('unused.driverGridPosition.description')}
          componentName="DriverGridPosition"
          code="<DriverGridPosition />"
        />
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg flex gap-4">
          {drivers.slice(0, 2).map((driver, idx) => (
            <DriverGridPosition key={driver.id} driver={driver} row={1} side={idx === 0 ? 'left' : 'right'} />
          ))}
        </div>
      </section>

      {/* DriverStanding - Unused */}
      <section>
        <SectionHeader
          title={t('unused.driverStanding.title')}
          description={t('unused.driverStanding.description')}
          componentName="DriverStanding"
          code="<DriverStanding />"
        />
        <div className="space-y-2">
          {drivers.slice(0, 3).map((driver, idx) => (
            <DriverStanding
              key={driver.id}
              driver={driver}
              position={idx + 1}
              points={25 - idx * 7}
              change={idx === 0 ? 1 : idx === 1 ? -1 : 0}
            />
          ))}
        </div>
      </section>

      {/* DriverSelectCard - Unused */}
      <section>
        <SectionHeader
          title={t('unused.driverSelectCard.title')}
          description={t('unused.driverSelectCard.description')}
          componentName="DriverSelectCard"
          code="<DriverSelectCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {drivers.slice(0, 3).map((driver) => (
            <DriverSelectCard key={driver.id} driver={driver} selected={false} onToggle={() => {}} />
          ))}
        </div>
      </section>

      {/* EntityCard - Unused */}
      <section>
        <SectionHeader
          title={t('unused.entityCard.title')}
          description={t('unused.entityCard.description')}
          componentName="EntityCard"
          code="<EntityCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drivers.slice(0, 2).map((driver) => (
            <EntityCard
              key={driver.id}
              image={driver.img}
              title={driver.name}
              subtitle={t('unused.entityCard.subtitle')}
              color={driver.color}
              onClick={() => {}}
            >
              <StatBadge label="Stat" value={42} />
            </EntityCard>
          ))}
        </div>
      </section>

      {/* StatBadge - Unused */}
      <section>
        <SectionHeader
          title={t('unused.statBadge.title')}
          description={t('unused.statBadge.description')}
          componentName="StatBadge"
          code="<StatBadge />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex gap-4">
          <StatBadge label="Demo 1" value={100} />
          <StatBadge label="Demo 2" value={50} />
        </div>
      </section>
    </>
  )
}
