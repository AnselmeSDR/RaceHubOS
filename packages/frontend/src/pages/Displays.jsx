import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Flag, Settings, Layers, AlertTriangle, Trophy } from 'lucide-react'
import { SessionType } from '@racehubos/shared'
import ChampionshipDisplays from '@/components/displays/ChampionshipDisplays'
import ConfigDisplays from '@/components/displays/ConfigDisplays'
import CRUDDisplays from '@/components/displays/CRUDDisplays'
import DriversDisplays from '@/components/displays/DriversDisplays'
import RaceDisplays from '@/components/displays/RaceDisplays'
import UnusedDisplays from '@/components/displays/UnusedDisplays'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function Displays() {
  const { t } = useTranslation('displays')
  const [activeTab, setActiveTab] = useState('drivers')
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  const tabs = [
    { id: 'drivers', label: t('tabs.drivers'), Icon: Users },
    { id: 'championship', label: t('tabs.championship'), Icon: Trophy },
    { id: 'race', label: t('tabs.race'), Icon: Flag },
    { id: 'crud', label: t('tabs.crud'), Icon: Layers },
    { id: 'config', label: t('tabs.config'), Icon: Settings },
    { id: 'unused', label: t('tabs.unused'), Icon: AlertTriangle },
  ]

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [driversRes, carsRes] = await Promise.all([fetch(`${API_URL}/drivers`), fetch(`${API_URL}/cars`)])
      const [driversData, carsData] = await Promise.all([driversRes.json(), carsRes.json()])
      setDrivers(driversData.data || [])
      setCars(carsData.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleDriver(driverId) {
    setSelectedDrivers((prev) => (prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]))
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('page.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('page.subtitle')}</p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav data-testid="display-tabs" className="-mb-px flex flex-wrap gap-x-8">
          {tabs.map((tab) => {
            const { Icon } = tab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
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

        {activeTab === 'championship' && <ChampionshipDisplays drivers={drivers} cars={cars} loading={loading} />}

        {activeTab === SessionType.RACE && <RaceDisplays drivers={drivers} cars={cars} loading={loading} />}

        {activeTab === 'crud' && <CRUDDisplays drivers={drivers} loading={loading} />}

        {activeTab === 'config' && <ConfigDisplays drivers={drivers} cars={cars} loading={loading} />}

        {activeTab === 'unused' && <UnusedDisplays drivers={drivers} loading={loading} />}
      </div>
    </div>
  )
}
