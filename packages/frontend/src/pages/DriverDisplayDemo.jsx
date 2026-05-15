import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DriverListItem,
  DriverBadge,
  DriverGridPosition,
  DriverProfileHeader,
  DriverStanding,
  DriverSelectCard
} from '../components/DriverDisplays'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function DriverDisplayDemo() {
  const { t } = useTranslation('displays')
  const [drivers, setDrivers] = useState([])
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDrivers()
  }, [])

  async function loadDrivers() {
    try {
      const res = await fetch(`${API_URL}/drivers`)
      const data = await res.json()
      setDrivers(data.data || [])
    } catch (error) {
      console.error('Failed to load drivers:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleDriver(driverId) {
    setSelectedDrivers(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  const demoDriver = drivers[0]

  return (
    <div className="p-8 space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('demo.title')}
        </h1>
        <p className="text-gray-600">
          {t('demo.subtitle')}
        </p>
      </div>

      {demoDriver && (
        <>
          {/* DriverProfileHeader */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('demo.profileHeader.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('demo.profileHeader.description')}
            </p>
            <DriverProfileHeader driver={demoDriver} />
          </section>

          {/* DriverListItem */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('demo.listItem.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('demo.listItem.description')}
            </p>
            <div className="space-y-3 bg-white p-6 rounded-lg shadow">
              {drivers.slice(0, 4).map((driver, index) => (
                <DriverListItem
                  key={driver.id}
                  driver={driver}
                  position={index + 1}
                  showStats={true}
                />
              ))}
            </div>
          </section>

          {/* DriverGridPosition */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('demo.gridPosition.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('demo.gridPosition.description')}
            </p>
            <div className="bg-gray-100 p-6 rounded-lg space-y-4">
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
                          <div className="font-black text-3xl text-gray-900">{row}</div>
                        </div>
                      </>
                    )}
                    {side === 'right' && (
                      <>
                        <div className="w-20 text-center">
                          <div className="font-black text-2xl text-gray-400">{t('drivers.row')}</div>
                          <div className="font-black text-3xl text-gray-900">{row}</div>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('demo.standing.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('demo.standing.description')}
            </p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('demo.selectCard.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('demo.selectCard.description')}
            </p>
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
            {selectedDrivers.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="font-bold text-blue-900">
                  {t('demo.selectCard.selectedCount', { count: selectedDrivers.length })}
                </p>
              </div>
            )}
          </section>

          {/* DriverBadge */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('demo.badge.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('demo.badge.description')}
            </p>
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">{t('drivers.sizeSmall')}</p>
                <div className="flex flex-wrap gap-3">
                  {drivers.slice(0, 6).map((driver) => (
                    <DriverBadge key={driver.id} driver={driver} size="sm" showName={false} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">{t('drivers.sizeMedium')}</p>
                <div className="flex flex-wrap gap-3">
                  {drivers.slice(0, 4).map((driver) => (
                    <DriverBadge key={driver.id} driver={driver} size="md" showName={true} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">{t('drivers.sizeLarge')}</p>
                <div className="flex flex-wrap gap-3">
                  {drivers.slice(0, 3).map((driver) => (
                    <DriverBadge key={driver.id} driver={driver} size="lg" showName={false} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">{t('drivers.sizeExtraLarge')}</p>
                <div className="flex flex-wrap gap-3">
                  {drivers.slice(0, 2).map((driver) => (
                    <DriverBadge key={driver.id} driver={driver} size="xl" showName={false} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {!demoDriver && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {t('demo.noDriversFound')}
          </p>
        </div>
      )}
    </div>
  )
}
