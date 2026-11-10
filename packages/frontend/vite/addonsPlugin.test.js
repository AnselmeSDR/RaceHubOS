// @vitest-environment node
import fs from 'fs'
import os from 'os'
import path from 'path'
import { build, createServer } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { realPosix, toPosix } from '@racehubos/shared/addons'
import racehubosAddons, { localeFiles, SHARED_PACKAGES, VIRTUAL_ID, virtualModuleCode } from './addonsPlugin.js'

function write(root, relative, content) {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content))
  return file
}

const manifest = (id, extra = {}) => ({ id, name: id, version: '0.1.0', ...extra })

let root
let savedAddonsDir

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-vite-'))
  // The plugin must look at this root, not at the folder vitest.config.js points to
  savedAddonsDir = process.env.RACEHUBOS_ADDONS_DIR
  delete process.env.RACEHUBOS_ADDONS_DIR
})

afterEach(() => {
  process.env.RACEHUBOS_ADDONS_DIR = savedAddonsDir
  fs.rmSync(root, { recursive: true, force: true })
})

describe('localeFiles', () => {
  test('no folder, no files', () => {
    expect(localeFiles(null)).toEqual({})
  })

  test('one file per language, JSON only', () => {
    const dir = path.join(root, 'locales')
    write(root, 'locales/fr.json', '{}')
    write(root, 'locales/en.json', '{}')
    write(root, 'locales/notes.txt', '')
    expect(localeFiles(dir)).toEqual({ en: path.join(dir, 'en.json'), fr: path.join(dir, 'fr.json') })
  })
})

describe('virtualModuleCode', () => {
  test('no add-on, an empty list', () => {
    expect(virtualModuleCode([])).toBe('\nexport default [\n\n]\n')
  })

  test('imports the web entry and the translations, skips add-ons with neither', () => {
    const webEntry = write(root, 'a/web/index.jsx', '')
    const localesDir = path.dirname(write(root, 'a/web/locales/en.json', '{}'))
    write(root, 'b/web/locales/fr.json', '{}')
    const code = virtualModuleCode([
      { id: 'a', manifest: manifest('a'), webEntry, localesDir },
      { id: 'b', manifest: manifest('b'), webEntry: null, localesDir: path.join(root, 'b/web/locales') },
      { id: 'server-only', manifest: manifest('server-only'), webEntry: null, localesDir: null },
    ])
    expect(code).toContain(`import * as web0 from ${JSON.stringify(toPosix(webEntry))}`)
    expect(code).toContain(`import locale0_0 from ${JSON.stringify(toPosix(path.join(localesDir, 'en.json')))}`)
    expect(code).toContain(
      '{ id: "a", manifest: {"id":"a","name":"a","version":"0.1.0"}, web: web0.default ?? null, locales: { "en": locale0_0 } }'
    )
    expect(code).toContain(
      '{ id: "b", manifest: {"id":"b","name":"b","version":"0.1.0"}, web: null, locales: { "fr": locale1_0 } }'
    )
    expect(code).not.toContain('server-only')
  })
})

describe('plugin config', () => {
  test('keeps one copy of the shared packages and serves the whole repository', () => {
    const plugin = racehubosAddons({ rootDir: root })
    expect(plugin.config()).toEqual({ resolve: { dedupe: SHARED_PACKAGES }, server: { fs: { allow: [root] } } })
    expect(SHARED_PACKAGES).toContain('react')
  })

  test('serves an add-on linked from outside the repository', () => {
    const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-linked-')))
    try {
      write(elsewhere, 'racehubos-addon.json', manifest('linked'))
      write(root, 'addons/inside/racehubos-addon.json', manifest('inside'))
      fs.symlinkSync(elsewhere, path.join(root, 'addons/linked'))
      expect(racehubosAddons({ rootDir: root }).config().server.fs.allow).toEqual([root, elsewhere])
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true })
    }
  })

  test("Vitest's module cache is kept apart for each set of add-ons and overrides", () => {
    const keyOf = () => {
      const plugin = racehubosAddons({ rootDir: root })
      plugin.config()
      const generators = []
      plugin.configureVitest({ defineCacheKeyGenerator: (generator) => generators.push(generator) })
      return generators.map((generator) => generator({ id: '/src/page.js', sourceCode: '' })).join()
    }
    write(root, 'packages/frontend/src/board.js', 'export default 1')
    const none = keyOf()
    write(root, 'addons/sectors/racehubos-addon.json', manifest('sectors'))
    const pagesOnly = keyOf()
    write(root, 'addons/sectors/overrides/packages/frontend/src/board.js', "export * from '@base'")
    const overriding = keyOf()
    write(root, 'addons/.data/state.json', { disabled: { sectors: { reason: 'off' } }, installed: {} })
    const disabled = keyOf()

    expect(new Set([none, pagesOnly, overriding]).size).toBe(3)
    expect(disabled).toBe(none)
    expect(keyOf()).toBe(disabled)
  })

  test('load ignores other modules', () => {
    expect(racehubosAddons({ rootDir: root }).load('/src/main.jsx')).toBeNull()
  })
})

describe('in a real Vite server', () => {
  let server

  // A tiny repository: a core module, a core page using it, and two add-ons wrapping it
  const setup = async () => {
    write(root, 'packages/frontend/src/board.js', "export default () => ['core']\nexport const name = 'board'")
    write(root, 'packages/frontend/src/helper.js', "export const helper = 'helper from the core folder'")
    write(
      root,
      'packages/frontend/src/page.js',
      "import board, { name } from './board.js'\nexport default () => ({ rows: board(), name })"
    )
    write(root, 'packages/frontend/src/lonely.js', "export { default } from '@base'")
    write(root, 'packages/frontend/src/stranger.js', "export { default } from '@addon/x.js'")

    write(root, 'addons/sectors/racehubos-addon.json', manifest('sectors', { order: 100 }))
    write(
      root,
      'addons/sectors/overrides/packages/frontend/src/board.js',
      [
        "export * from '@base'",
        "import base from '@base'",
        "import label from '@addon/web/label.js'",
        // relative to the core file's folder, as if the override sat in its place
        "import { helper } from './helper.js'",
        'export default () => [...base(), label, helper]',
      ].join('\n')
    )
    write(root, 'addons/sectors/web/label.js', "export default 'sectors'")
    write(root, 'addons/sectors/web/index.js', 'export default { routes: [], nav: [] }')
    write(root, 'addons/sectors/web/locales/en.json', { nav: 'Sectors' })

    write(root, 'addons/pits/racehubos-addon.json', manifest('pits', { order: 200 }))
    write(
      root,
      'addons/pits/overrides/packages/frontend/src/board.js',
      "export * from '@base'\nimport base from '@base'\nexport default () => [...base(), 'pits']"
    )

    server = await createServer({
      configFile: false,
      root: path.join(root, 'packages/frontend'),
      plugins: [racehubosAddons({ rootDir: root })],
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, include: [] },
    })
  }

  afterEach(async () => {
    await server?.close()
    server = null
  })

  test('the app gets the top of the stack, each layer wraps the one below', async () => {
    await setup()
    const page = await server.ssrLoadModule('/src/page.js')
    expect(page.default()).toEqual({ rows: ['core', 'sectors', 'helper from the core folder', 'pits'], name: 'board' })
  })

  test('the virtual module lists the add-ons with web code or translations', async () => {
    await setup()
    const { default: addons } = await server.ssrLoadModule(VIRTUAL_ID)
    expect(addons).toEqual([
      {
        id: 'sectors',
        manifest: manifest('sectors', { order: 100 }),
        web: { routes: [], nav: [] },
        locales: { en: { nav: 'Sectors' } },
      },
    ])
  })

  test('@base outside an override is an error', async () => {
    await setup()
    await expect(server.ssrLoadModule('/src/lonely.js')).rejects.toThrow(
      '"@base" can only be imported from an override'
    )
  })

  test('@addon/ outside an add-on is an error', async () => {
    await setup()
    await expect(server.ssrLoadModule('/src/stranger.js')).rejects.toThrow(
      '"@addon/x.js" can only be imported from an add-on'
    )
  })

  test('a disabled add-on leaves the stack', async () => {
    write(root, 'addons/.data/state.json', { disabled: { pits: { reason: 'off' } }, installed: {} })
    await setup()
    const page = await server.ssrLoadModule('/src/page.js')
    expect(page.default().rows).toEqual(['core', 'sectors', 'helper from the core folder'])
  })

  test('without overrides, imports resolve as usual', async () => {
    write(root, 'packages/frontend/src/plain.js', "import x from './x.js?raw'\nexport default x")
    write(root, 'packages/frontend/src/x.js', 'content')
    server = await createServer({
      configFile: false,
      root: path.join(root, 'packages/frontend'),
      plugins: [racehubosAddons({ rootDir: root })],
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, include: [] },
    })
    const plain = await server.ssrLoadModule('/src/plain.js')
    expect(plain.default).toBe('content')
  })

  test("a package the add-on doesn't carry comes from the core, even for an add-on linked from elsewhere", async () => {
    write(root, 'node_modules/core-pkg/package.json', { name: 'core-pkg', type: 'module', main: 'index.js' })
    write(root, 'node_modules/core-pkg/index.js', "export default 'from the core'")
    // The add-on's own copy wins over the core's
    write(root, 'node_modules/own-pkg/package.json', { name: 'own-pkg', type: 'module', main: 'index.js' })
    write(root, 'node_modules/own-pkg/index.js', "export default 'core copy'")
    const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-linked-')))
    try {
      write(elsewhere, 'racehubos-addon.json', manifest('linked'))
      write(elsewhere, 'node_modules/own-pkg/package.json', { name: 'own-pkg', type: 'module', main: 'index.js' })
      write(elsewhere, 'node_modules/own-pkg/index.js', "export default 'its own copy'")
      const entry = write(
        elsewhere,
        'web/index.js',
        "import core from 'core-pkg'\nimport own from 'own-pkg'\nexport default [core, own]"
      )
      fs.mkdirSync(path.join(root, 'addons'), { recursive: true })
      fs.symlinkSync(elsewhere, path.join(root, 'addons/linked'))
      await setup()
      const loaded = await server.ssrLoadModule(entry)
      expect(loaded.default).toEqual(['from the core', 'its own copy'])
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true })
    }
  })

  test('the address @base gives leads back to the core file, even resolved on its own', async () => {
    await setup()
    await server.ssrLoadModule('/src/page.js')
    const { moduleGraph, pluginContainer } = server.environments.ssr
    const core = realPosix(path.join(root, 'packages/frontend/src/board.js'))
    const sectors = realPosix(path.join(root, 'addons/sectors/overrides/packages/frontend/src/board.js'))
    const below = [...moduleGraph.getModuleById(sectors).importedModules].find((mod) => mod.file === core)
    // Vitest's module cache resolves it again by its URL alone, without the layer that imported it
    const resolved = await pluginContainer.resolveId(below.url)
    expect(resolved.id.split('?')[0]).toBe(core)
  })

  test('a query on an overridden file is kept', async () => {
    await setup()
    write(root, 'packages/frontend/src/raw.js', "import source from './board.js?raw'\nexport default source")
    const raw = await server.ssrLoadModule('/src/raw.js')
    expect(raw.default).toContain("'pits'")
  })
})

describe('Tailwind', () => {
  // Inside the frontend's node_modules, so that tailwindcss resolves; that folder is also one
  // Tailwind never scans by itself, like the git-ignored addons/ folder of a real install
  const cacheDir = path.resolve(import.meta.dirname, '../node_modules/.cache')
  let repo, elsewhere

  beforeEach(() => {
    fs.mkdirSync(cacheDir, { recursive: true })
    repo = fs.realpathSync(fs.mkdtempSync(path.join(cacheDir, 'racehubos-tailwind-')))
    elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-linked-')))
  })
  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true })
    fs.rmSync(elsewhere, { recursive: true, force: true })
  })

  const page = (className) => `export default () => <p className="${className}" />`

  test('the build generates the classes of every enabled add-on, installed or linked, and of none other', async () => {
    write(repo, 'packages/frontend/index.html', '<script type="module" src="/src/main.js"></script>')
    write(repo, 'packages/frontend/src/main.js', "import './index.css'")
    write(repo, 'packages/frontend/src/index.css', "@import 'tailwindcss';")
    write(repo, 'addons/installed/racehubos-addon.json', manifest('installed'))
    write(repo, 'addons/installed/web/Page.jsx', page('tracking-[7px]'))
    write(repo, 'addons/off/racehubos-addon.json', manifest('off'))
    write(repo, 'addons/off/web/Page.jsx', page('tracking-[9px]'))
    write(repo, 'addons/.data/state.json', { disabled: { off: { reason: 'off' } }, installed: {} })
    write(elsewhere, 'racehubos-addon.json', manifest('linked'))
    write(elsewhere, 'web/Page.jsx', page('tracking-[8px]'))
    fs.symlinkSync(elsewhere, path.join(repo, 'addons/linked'))

    const output = await build({
      configFile: false,
      root: path.join(repo, 'packages/frontend'),
      plugins: [racehubosAddons({ rootDir: repo }), tailwindcss()],
      build: { write: false },
      logLevel: 'silent',
    })
    const css = output.output.find((file) => file.fileName.endsWith('.css')).source
    expect(css).toContain('letter-spacing:7px')
    expect(css).toContain('letter-spacing:8px')
    expect(css).not.toContain('letter-spacing:9px')
  })
})
