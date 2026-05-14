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
  Scale,
  Terminal,
  Settings,
} from 'lucide-react'

// labelKey resolves against the 'layout' namespace, unless `glossary: true`
// in which case it resolves against 'glossary' (plural form).
export const allNavItems = [
  { to: '/', labelKey: 'nav.dashboard', Icon: BarChart3 },
  { to: '/race', labelKey: 'nav.freeMode', Icon: Flag },
  { to: '/championships', labelKey: 'championship', glossary: true, Icon: Trophy },
  { to: '/history', labelKey: 'nav.history', Icon: Clock },
  { to: '/tracks', labelKey: 'track', glossary: true, Icon: Map },
  { to: '/teams', labelKey: 'team', glossary: true, Icon: Users2 },
  { to: '/drivers', labelKey: 'driver', glossary: true, Icon: Users },
  { to: '/cars', labelKey: 'car', glossary: true, Icon: Car },
  { to: '/stats', labelKey: 'nav.stats', Icon: BarChart3 },
  { to: '/balancing', labelKey: 'nav.balancing', Icon: Scale },
  { to: '/displays', labelKey: 'nav.displays', Icon: LayoutGrid, adminOnly: true },
  { to: '/test', labelKey: 'nav.test', Icon: Terminal, adminOnly: true },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
]

// Resolves a nav item label. `t` must be a translation function bound to
// the 'layout' namespace (glossary items are resolved with an explicit ns).
export function navLabel(t, item) {
  return item.glossary
    ? t(item.labelKey, { ns: 'glossary', count: 2 })
    : t(item.labelKey)
}
