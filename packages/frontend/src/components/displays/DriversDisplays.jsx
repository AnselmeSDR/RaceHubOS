import { useTranslation } from 'react-i18next'
import {
  DriverListItem,
  DriverBadge,
  DriverGridPosition,
  DriverProfileHeader,
  DriverStanding,
  DriverSelectCard,
} from '@/components/DriverDisplays'
import SectionHeader from './SectionHeader'
import LoadingState from './LoadingState'

export default function DriversDisplays({ drivers, selectedDrivers, toggleDriver, loading }) {
  const { t } = useTranslation('displays')

  if (loading) {
    return <LoadingState />
  }

  if (drivers.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p className="text-gray-500 dark:text-gray-400">{t('noDriversFound')}</p>
      </div>
    )
  }

  const demoDriver = drivers[0]

  return (
    <>
      {/* DriverProfileHeader */}
      <section>
        <SectionHeader
          title={t('drivers.profileHeader.title')}
          description={t('drivers.profileHeader.description')}
          componentName="DriverProfileHeader"
          code="<DriverProfileHeader />"
        />
        <DriverProfileHeader driver={demoDriver} />
      </section>

      {/* DriverListItem */}
      <section>
        <SectionHeader
          title={t('drivers.listItem.title')}
          description={t('drivers.listItem.description')}
          componentName="DriverListItem"
          code="<DriverListItem />"
        />
        <div className="space-y-3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          {drivers.slice(0, 4).map((driver, index) => (
            <DriverListItem key={driver.id} driver={driver} position={index + 1} showStats={true} />
          ))}
        </div>
      </section>

      {/* DriverGridPosition */}
      <section>
        <SectionHeader
          title={t('drivers.gridPosition.title')}
          description={t('drivers.gridPosition.description')}
          componentName="DriverGridPosition"
          code="<DriverGridPosition />"
        />
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg space-y-4">
          {drivers.slice(0, 6).map((driver, index) => {
            const row = Math.floor(index / 2) + 1
            const side = index % 2 === 0 ? 'left' : 'right'
            return (
              <div key={driver.id} className="flex items-center gap-6">
                {side === 'left' && (
                  <>
                    <DriverGridPosition driver={driver} row={row} side="left" />
                    <div className="w-20 text-center">
                      <div className="font-black text-2xl text-gray-400">{t('drivers.row')}</div>
                      <div className="font-black text-3xl text-gray-900 dark:text-white">{row}</div>
                    </div>
                  </>
                )}
                {side === 'right' && (
                  <>
                    <div className="w-20 text-center">
                      <div className="font-black text-2xl text-gray-400">{t('drivers.row')}</div>
                      <div className="font-black text-3xl text-gray-900 dark:text-white">{row}</div>
                    </div>
                    <DriverGridPosition driver={driver} row={row} side="right" />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* DriverStanding */}
      <section>
        <SectionHeader
          title={t('drivers.standing.title')}
          description={t('drivers.standing.description')}
          componentName="DriverStanding"
          code="<DriverStanding />"
        />
        <div className="space-y-3">
          {drivers.slice(0, 5).map((driver, index) => (
            <DriverStanding
              key={driver.id}
              driver={driver}
              position={index + 1}
              points={25 - index * 3}
              change={index === 0 ? 2 : index === 1 ? -1 : 0}
            />
          ))}
        </div>
      </section>

      {/* DriverSelectCard */}
      <section>
        <SectionHeader
          title={t('drivers.selectCard.title')}
          description={t('drivers.selectCard.description')}
          componentName="DriverSelectCard"
          code="<DriverSelectCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <DriverSelectCard
              key={driver.id}
              driver={driver}
              selected={selectedDrivers.includes(driver.id)}
              onToggle={() => toggleDriver(driver.id)}
            />
          ))}
        </div>
      </section>

      {/* DriverBadge */}
      <section>
        <SectionHeader
          title={t('drivers.badge.title')}
          description={t('drivers.badge.description')}
          componentName="DriverBadge"
          code="<DriverBadge />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{t('drivers.sizeSmall')}</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 6).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="sm" showName={false} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{t('drivers.sizeMedium')}</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 4).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="md" showName={true} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{t('drivers.sizeLarge')}</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 3).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="lg" showName={false} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
