import {
  BarChart3,
  Flag,
  Trophy,
  Clock,
  Users,
  Car,
  Map,
  Medal,
  LayoutGrid,
  Scale,
  Terminal,
  Puzzle,
  Settings,
} from 'lucide-react'
import addons from 'virtual:racehubos-addons'
import { addonNavItems } from '@/addons/registry'

// labelKey resolves against the 'layout' namespace, unless `glossary: true`
// in which case it resolves against 'glossary' (plural form), or `ns` (an add-on).
export const coreNavItems = [
  { to: '/', labelKey: 'nav.dashboard', Icon: BarChart3 },
  { to: '/race', labelKey: 'nav.freeMode', Icon: Flag },
  { to: '/championships', labelKey: 'championship', glossary: true, Icon: Trophy },
  { to: '/history', labelKey: 'nav.history', Icon: Clock },
  { to: '/tracks', labelKey: 'track', glossary: true, Icon: Map },
  { to: '/divisions', labelKey: 'division', glossary: true, Icon: Medal },
  { to: '/drivers', labelKey: 'driver', glossary: true, Icon: Users },
  { to: '/cars', labelKey: 'car', glossary: true, Icon: Car },
  { to: '/stats', labelKey: 'nav.stats', Icon: BarChart3 },
  { to: '/balancing', labelKey: 'nav.balancing', Icon: Scale },
  { to: '/displays', labelKey: 'nav.displays', Icon: LayoutGrid, adminOnly: true },
  { to: '/test', labelKey: 'nav.test', Icon: Terminal, adminOnly: true },
  { to: '/addons', labelKey: 'nav.addons', Icon: Puzzle },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
]

/** Core entries with the add-on entries inserted before Settings, which stays last. */
export function withAddonNavItems(core, addonItems) {
  return [...core.slice(0, -1), ...addonItems, core[core.length - 1]]
}

export const allNavItems = withAddonNavItems(coreNavItems, addonNavItems(addons))

/** The entry a page belongs to: the longest `to` that starts its path. */
export function findNavItem(items, pathname) {
  return items
    .filter((item) => (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0]
}

// Resolves a nav item label. `t` must be a translation function bound to
// the 'layout' namespace (glossary items are resolved with an explicit ns).
export function navLabel(t, item) {
  if (item.ns) return t(item.labelKey, { ns: item.ns })
  return item.glossary ? t(item.labelKey, { ns: 'glossary', count: 2 }) : t(item.labelKey)
}
