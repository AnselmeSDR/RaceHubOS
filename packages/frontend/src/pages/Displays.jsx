import { useState, useEffect } from 'react'
import {
  UserGroupIcon,
  TruckIcon,
  MapIcon,
  FlagIcon,
} from '@heroicons/react/24/outline'
import {
  DriverListItem,
  DriverBadge,
  DriverGridPosition,
  DriverProfileHeader,
  DriverStanding,
  DriverSelectCard
} from '../components/DriverDisplays'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function Displays() {
  const [activeTab, setActiveTab] = useState('drivers')
  const [drivers, setDrivers] = useState([])
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  const tabs = [
    { id: 'drivers', label: 'Pilotes', Icon: UserGroupIcon },
    { id: 'cars', label: 'Voitures', Icon: TruckIcon, disabled: true },
    { id: 'tracks', label: 'Circuits', Icon: MapIcon, disabled: true },
    { id: 'races', label: 'Courses', Icon: FlagIcon, disabled: true },
  ]

  useEffect(() => {
    if (activeTab === 'drivers') {
      loadDrivers()
    }
  }, [activeTab])

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Displays - Composants d'affichage
        </h1>
        <p className="text-gray-600">
          Collection de tous les composants d'affichage utilisés dans l'application
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const { Icon } = tab
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
                {tab.disabled && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-2">
                    Bientôt
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-12">
        {activeTab === 'drivers' && (
          <DriversDisplays
            drivers={drivers}
            selectedDrivers={selectedDrivers}
            toggleDriver={toggleDriver}
            loading={loading}
          />
        )}

        {activeTab === 'cars' && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <TruckIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Composants Voitures - À venir</p>
          </div>
        )}

        {activeTab === 'tracks' && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <MapIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Composants Circuits - À venir</p>
          </div>
        )}

        {activeTab === 'races' && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <FlagIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Composants Courses - À venir</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Drivers Displays Tab
function DriversDisplays({ drivers, selectedDrivers, toggleDriver, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (drivers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-500">
          Aucun pilote trouvé. Ajoutez des pilotes pour voir les composants.
        </p>
      </div>
    )
  }

  const demoDriver = drivers[0]

  return (
    <>
      {/* DriverProfileHeader */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Profile Header</h2>
            <p className="text-gray-600 text-sm">
              En-tête de profil détaillé avec toutes les statistiques
            </p>
          </div>
          <code className="text-sm bg-gray-100 px-3 py-1 rounded">
            {'<DriverProfileHeader />'}
          </code>
        </div>
        <DriverProfileHeader driver={demoDriver} />
      </section>

      {/* DriverListItem */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">List Item</h2>
            <p className="text-gray-600 text-sm">
              Format liste compact pour sélections et vues compactes
            </p>
          </div>
          <code className="text-sm bg-gray-100 px-3 py-1 rounded">
            {'<DriverListItem />'}
          </code>
        </div>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Grid Position</h2>
            <p className="text-gray-600 text-sm">
              Grille de départ style NASCAR avec ROW
            </p>
          </div>
          <code className="text-sm bg-gray-100 px-3 py-1 rounded">
            {'<DriverGridPosition />'}
          </code>
        </div>
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
                      <div className="font-black text-2xl text-gray-400">ROW</div>
                      <div className="font-black text-3xl text-gray-900">{row}</div>
                    </div>
                  </>
                )}
                {side === 'right' && (
                  <>
                    <div className="w-20 text-center">
                      <div className="font-black text-2xl text-gray-400">ROW</div>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Standing</h2>
            <p className="text-gray-600 text-sm">
              Classement avec position, points et changement
            </p>
          </div>
          <code className="text-sm bg-gray-100 px-3 py-1 rounded">
            {'<DriverStanding />'}
          </code>
        </div>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Select Card</h2>
            <p className="text-gray-600 text-sm">
              Sélection multi-pilotes pour configuration de session
            </p>
          </div>
          <code className="text-sm bg-gray-100 px-3 py-1 rounded">
            {'<DriverSelectCard />'}
          </code>
        </div>
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
              {selectedDrivers.length} pilote{selectedDrivers.length > 1 ? 's' : ''} sélectionné{selectedDrivers.length > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </section>

      {/* DriverBadge */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Badge</h2>
            <p className="text-gray-600 text-sm">
              Badges compacts pour menus, notifications, etc.
            </p>
          </div>
          <code className="text-sm bg-gray-100 px-3 py-1 rounded">
            {'<DriverBadge />'}
          </code>
        </div>
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Small</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 6).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="sm" showName={false} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Medium (avec nom)</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 4).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="md" showName={true} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Large</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 3).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="lg" showName={false} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Extra Large</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 2).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="xl" showName={false} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
