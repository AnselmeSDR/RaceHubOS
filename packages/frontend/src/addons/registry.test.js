import { Puzzle, PenTool } from 'lucide-react'
import { addonNavItems, addonPath, addonRoutes, registerAddonLocales } from './registry'

const Page = () => null
const Screen = () => null

const planner = {
  id: 'track-planner',
  web: {
    routes: [
      { path: '', component: Page },
      { path: '/:trackId/', component: Page },
      { path: 'screen', component: Screen, layout: false },
    ],
    nav: [
      { to: '', labelKey: 'nav', Icon: PenTool },
      { to: 'screen', labelKey: 'screen', adminOnly: true },
    ],
  },
  locales: { en: { nav: 'Planner' }, fr: { nav: 'Éditeur' } },
}

describe('addonPath', () => {
  test('joins the add-on base and a relative path', () => {
    expect(addonPath('a')).toBe('/addons/a')
    expect(addonPath('a', '')).toBe('/addons/a')
    expect(addonPath('a', '/x/y/')).toBe('/addons/a/x/y')
    expect(addonPath('a', null)).toBe('/addons/a')
  })
})

describe('addonRoutes', () => {
  test('mounts every route under /addons/<id>', () => {
    expect(addonRoutes([planner])).toEqual([
      { key: 'track-planner:', addonId: 'track-planner', path: 'addons/track-planner', Component: Page, layout: true },
      {
        key: 'track-planner::trackId',
        addonId: 'track-planner',
        path: 'addons/track-planner/:trackId',
        Component: Page,
        layout: true,
      },
      {
        key: 'track-planner:screen',
        addonId: 'track-planner',
        path: 'addons/track-planner/screen',
        Component: Screen,
        layout: false,
      },
    ])
  })

  test('an add-on without web code or routes brings none', () => {
    expect(
      addonRoutes([
        { id: 'a', web: null },
        { id: 'b', web: {} },
      ])
    ).toEqual([])
  })

  test('skips malformed routes with a warning', () => {
    const warn = vi.fn()
    const routes = addonRoutes(
      [{ id: 'a', web: { routes: [null, { path: 3, component: Page }, { path: 'x' }] } }],
      warn
    )
    expect(routes).toEqual([])
    expect(warn).toHaveBeenCalledTimes(3)
    expect(warn.mock.calls[0][0]).toMatch(/^\[addon:a\] ignored route/)
  })

  test('warns on the console by default', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    addonRoutes([{ id: 'a', web: { routes: [{}] } }])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('addonNavItems', () => {
  test('in the shape of the core entries', () => {
    expect(addonNavItems([planner])).toEqual([
      {
        to: '/addons/track-planner',
        labelKey: 'nav',
        ns: 'track-planner',
        Icon: PenTool,
        adminOnly: false,
        addon: 'track-planner',
      },
      {
        to: '/addons/track-planner/screen',
        labelKey: 'screen',
        ns: 'track-planner',
        Icon: Puzzle,
        adminOnly: true,
        addon: 'track-planner',
      },
    ])
  })

  test('skips entries without labelKey', () => {
    const warn = vi.fn()
    expect(addonNavItems([{ id: 'a', web: { nav: [{ to: '' }, null] } }], warn)).toEqual([])
    expect(warn).toHaveBeenCalledTimes(2)
  })

  test('warns on the console by default', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    addonNavItems([{ id: 'a', web: { nav: [{}] } }])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('nothing without web code', () => {
    expect(addonNavItems([{ id: 'a' }])).toEqual([])
  })
})

describe('registerAddonLocales', () => {
  test('one namespace per add-on, every language', () => {
    const i18n = { addResourceBundle: vi.fn() }
    expect(registerAddonLocales(i18n, [planner, { id: 'silent' }], ['common'])).toEqual([])
    expect(i18n.addResourceBundle.mock.calls).toEqual([
      ['en', 'track-planner', { nav: 'Planner' }, true, true],
      ['fr', 'track-planner', { nav: 'Éditeur' }, true, true],
    ])
  })

  test('an add-on named like a core namespace cannot overwrite its texts', () => {
    const i18n = { addResourceBundle: vi.fn() }
    const error = vi.fn()
    const refused = registerAddonLocales(i18n, [{ id: 'race', locales: { en: { title: 'x' } } }], ['race'], error)
    expect(refused).toEqual(['race'])
    expect(i18n.addResourceBundle).not.toHaveBeenCalled()
    expect(error.mock.calls[0][0]).toMatch(/"race" is a core namespace/)
  })

  test('reports on the console by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerAddonLocales({ addResourceBundle: vi.fn() }, [{ id: 'race', locales: { en: {} } }], ['race'])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
