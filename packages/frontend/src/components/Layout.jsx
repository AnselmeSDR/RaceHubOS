import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  ChartBarIcon,
  UserGroupIcon,
  TruckIcon,
  MapIcon,
  UsersIcon,
  BeakerIcon,
  Squares2X2Icon,
  FlagIcon,
  CogIcon,
  TrophyIcon,
  XMarkIcon,
  Bars3Icon,
  CommandLineIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import BackendStatusPopup from './BackendStatusPopup'
import { useDevice, SIMULATOR_ADDRESS } from '../context/DeviceContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const CU_STATE_NAMES = {
  0: 'Racing',
  1: 'Lights 1/5',
  2: 'Lights 2/5',
  3: 'Lights 3/5',
  4: 'Lights 4/5',
  5: 'Lights 5/5',
  6: 'False Start',
  7: 'Go!',
  8: 'Stopped',
  9: 'Stopped'
}

export default function Layout() {
  const { cuStatus, connected: cuConnected, deviceAddress, lastTimer } = useDevice()
  const isSimulator = deviceAddress === SIMULATOR_ADDRESS
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen')
    return saved !== null ? saved === 'true' : true
  })
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen)
  }, [sidebarOpen])
  const [backendConnected, setBackendConnected] = useState(true)
  const [backendVersion, setBackendVersion] = useState('0.1.0')

  // Check backend health periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/health`)
        const data = await res.json()
        setBackendConnected(data.status === 'ok')
        setBackendVersion(data.version || '0.1.0')
      } catch {
        setBackendConnected(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => clearInterval(interval)
  }, [])
  const navItems = [
    { to: '/', label: 'Dashboard', Icon: ChartBarIcon },
    { to: '/race', label: 'Mode Libre', Icon: FlagIcon },
    { to: '/championships', label: 'Championnats', Icon: TrophyIcon },
    { to: '/history', label: 'Historique', Icon: ClockIcon },
    { to: '/drivers', label: 'Pilotes', Icon: UserGroupIcon },
    { to: '/cars', label: 'Voitures', Icon: TruckIcon },
    { to: '/tracks', label: 'Circuits', Icon: MapIcon },
    { to: '/teams', label: 'Équipes', Icon: UsersIcon },
    { to: '/stats', label: 'Statistiques', Icon: TrophyIcon },
    { to: '/displays', label: 'Displays', Icon: Squares2X2Icon },
    { to: '/simulator', label: 'Simulateur', Icon: BeakerIcon },
    { to: '/test', label: 'Test', Icon: CommandLineIcon },
    { to: '/settings', label: 'Paramètres', Icon: CogIcon },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          {sidebarOpen ? (
            <>
              <div>
                <h1 className="text-2xl font-bold">RaceHubOS</h1>
                <p className="text-sm text-gray-400 mt-1">Carrera Digital 132/124</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Réduire"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors mx-auto"
              title="Agrandir"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const { Icon } = item
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                    title={!sidebarOpen ? item.label : ''}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && <span className="font-medium">{item.label}</span>}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => setStatusPopupOpen(true)}
            className={`w-full text-left rounded-lg transition-colors ${sidebarOpen ? 'p-2 hover:bg-gray-800' : ''}`}
            title="Voir les logs"
          >
            {sidebarOpen ? (
              <div className="text-xs text-gray-400">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span>{backendConnected ? 'Backend connecté' : 'Backend déconnecté'}</span>
                </div>
                <div>Version {backendVersion}</div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div
                  className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                  title={backendConnected ? 'Backend connecté' : 'Backend déconnecté'}
                ></div>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
        {/* CU Status Footer */}
        <footer className="bg-gray-900 border-t border-gray-700 px-4 py-1.5 text-xs font-mono flex items-center gap-1 text-gray-400">
          <div className={`w-1.5 h-1.5 rounded-full ${cuConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={cuConnected ? (isSimulator ? 'text-purple-400' : 'text-green-400') : 'text-red-400'}>
            {cuConnected ? (isSimulator ? 'SIMULATOR' : 'CU') : 'NO CU'}
          </span>
          <span className="text-gray-600 mx-1">|</span>
          <span className={cuStatus?.start === 0 ? 'text-green-400' : cuStatus?.start >= 1 && cuStatus?.start <= 7 ? 'text-yellow-400' : 'text-gray-500'}>
            {CU_STATE_NAMES[cuStatus?.start] || 'Unknown'}
          </span>
          <span className="text-gray-600 mx-1">|</span>
          <span>Mode {cuStatus?.mode ?? '-'}</span>
          {lastTimer && (
            <>
              <span className="text-gray-600 mx-1">|</span>
              <span className="text-blue-400">C{lastTimer.controller + 1}</span>
              <span className="text-green-400 ml-1">{(lastTimer.lapTime / 1000).toFixed(3)}s</span>
            </>
          )}
        </footer>
      </main>

      {/* Backend Status Popup */}
      <BackendStatusPopup
        isOpen={statusPopupOpen}
        onClose={() => setStatusPopupOpen(false)}
      />
    </div>
  )
}
