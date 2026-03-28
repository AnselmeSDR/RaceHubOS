import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Flag,
  Trophy,
  Clock,
  Users,
  Car,
  Map,
  Users2,
  LayoutGrid,
  FlaskConical,
  Terminal,
  Settings,
  Sun,
  Moon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { useTheme } from '../context/ThemeContext'

export const allNavItems = [
  { to: '/', label: 'Dashboard', Icon: BarChart3 },
  { to: '/race', label: 'Mode Libre', Icon: Flag },
  { to: '/championships', label: 'Championnats', Icon: Trophy },
  { to: '/history', label: 'Historique', Icon: Clock },
  { to: '/drivers', label: 'Pilotes', Icon: Users },
  { to: '/cars', label: 'Voitures', Icon: Car },
  { to: '/tracks', label: 'Circuits', Icon: Map },
  { to: '/teams', label: 'Équipes', Icon: Users2 },
  { to: '/stats', label: 'Statistiques', Icon: BarChart3 },
  { to: '/displays', label: 'Displays', Icon: LayoutGrid, adminOnly: true },
  { to: '/simulator', label: 'Simulateur', Icon: FlaskConical, adminOnly: true },
  { to: '/test', label: 'Test', Icon: Terminal, adminOnly: true },
  { to: '/settings', label: 'Paramètres', Icon: Settings },
]

export default function AppSidebar({ backendConnected, backendVersion, onStatusClick, ...props }) {
  const { isDark, toggleTheme, isAdmin } = useTheme()
  const location = useLocation()

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin)

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(to + '/')
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <img src="/logo.png" alt="RaceHubOS" className="size-10 rounded-lg object-cover" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold">RaceHubOS</span>
                  <span className="truncate text-xs text-muted-foreground">Carrera Digital 132/124</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.Icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} tooltip={isDark ? 'Mode jour' : 'Mode nuit'}>
              {isDark ? <Sun /> : <Moon />}
              <span>{isDark ? 'Mode jour' : 'Mode nuit'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onStatusClick} tooltip={backendConnected ? 'Backend connecté' : 'Backend déconnecté'}>
              <div className={`size-2 rounded-full shrink-0 ${backendConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs truncate">
                {backendConnected ? `Connecté — v${backendVersion}` : 'Backend déconnecté'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  )
}
