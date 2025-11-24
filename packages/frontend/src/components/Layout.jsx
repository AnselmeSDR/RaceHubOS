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
} from '@heroicons/react/24/outline'

export default function Layout() {
  const navItems = [
    { to: '/', label: 'Dashboard', Icon: ChartBarIcon },
    { to: '/drivers', label: 'Pilotes', Icon: UserGroupIcon },
    { to: '/cars', label: 'Voitures', Icon: TruckIcon },
    { to: '/tracks', label: 'Circuits', Icon: MapIcon },
    { to: '/teams', label: 'Équipes', Icon: UsersIcon },
    { to: '/sessions', label: 'Sessions', Icon: FlagIcon },
    { to: '/stats', label: 'Statistiques', Icon: TrophyIcon },
    { to: '/displays', label: 'Displays', Icon: Squares2X2Icon },
    { to: '/simulator', label: 'Simulateur', Icon: BeakerIcon },
    { to: '/settings', label: 'Paramètres', Icon: CogIcon },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold">RaceHubOS</h1>
          <p className="text-sm text-gray-400 mt-1">Carrera Digital 132/124</p>
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
                      `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Backend connecté</span>
            </div>
            <div>Version 0.1.0</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
