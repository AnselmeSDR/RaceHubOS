import { allNavItems, coreNavItems, findNavItem, navLabel, withAddonNavItems } from './navItems'

describe('withAddonNavItems', () => {
  test('add-on entries go before Settings, which stays last', () => {
    const addonItem = { to: '/addons/planner', labelKey: 'nav', ns: 'planner' }
    const items = withAddonNavItems(coreNavItems, [addonItem])
    expect(items).toHaveLength(coreNavItems.length + 1)
    expect(items.at(-2)).toBe(addonItem)
    expect(items.at(-1).to).toBe('/settings')
  })

  test('without add-ons, the core entries are unchanged', () => {
    expect(withAddonNavItems(coreNavItems, [])).toEqual(coreNavItems)
  })

  test('the tests run without add-ons', () => {
    expect(allNavItems).toEqual(coreNavItems)
  })
})

describe('findNavItem', () => {
  const items = withAddonNavItems(coreNavItems, [
    { to: '/addons/planner', labelKey: 'nav', ns: 'planner' },
    { to: '/addons/planner/screen', labelKey: 'screen', ns: 'planner' },
  ])

  test.each([
    ['/', '/'],
    ['/drivers', '/drivers'],
    ['/drivers/42', '/drivers'],
    ['/addons/planner', '/addons/planner'],
    ['/addons/planner/track-1', '/addons/planner'],
    ['/addons/planner/screen', '/addons/planner/screen'],
    ['/addons', '/addons'],
    ['/addons/other', '/addons'],
  ])('%s belongs to %s', (pathname, to) => {
    expect(findNavItem(items, pathname).to).toBe(to)
  })

  test.each(['/sessions/3', '/driversx', '/addonsx'])('%s belongs to nothing', (pathname) => {
    expect(findNavItem(items, pathname)).toBeUndefined()
  })
})

describe('navLabel', () => {
  const t = (key, options) => `${options?.ns ?? 'layout'}:${key}${options?.count ? `:${options.count}` : ''}`

  test('core, glossary and add-on labels', () => {
    expect(navLabel(t, { labelKey: 'nav.dashboard' })).toBe('layout:nav.dashboard')
    expect(navLabel(t, { labelKey: 'track', glossary: true })).toBe('glossary:track:2')
    expect(navLabel(t, { labelKey: 'nav', ns: 'planner' })).toBe('planner:nav')
  })
})
