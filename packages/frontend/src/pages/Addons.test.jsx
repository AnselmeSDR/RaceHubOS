import { StrictMode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { waitForRestart } from '@/components/addons/api'
import Addons from './Addons'

const socket = vi.hoisted(() => ({
  handlers: {},
  on(event, handler) {
    this.handlers[event] = handler
  },
  disconnect: () => {},
}))
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }))
vi.mock('@/components/addons/api', async (original) => ({ ...(await original()), waitForRestart: vi.fn() }))

const planner = {
  id: 'planner',
  manifest: {
    id: 'planner',
    name: { en: 'Track planner', fr: 'Éditeur de circuit' },
    description: { en: 'Draw your track' },
    version: '0.1.0',
    author: 'WillibaldSoft',
  },
  valid: true,
  errors: [],
  enabled: true,
  disabledReason: null,
  installed: { source: 'catalog', repo: 'https://x/planner.git', ref: 'v0.1.0' },
  update: { ref: 'v0.2.0' },
}
const mine = {
  id: 'mine',
  manifest: { id: 'mine', name: 'Mine', version: '1.0.0' },
  valid: true,
  errors: [],
  enabled: false,
  disabledReason: 'build failed: missing export',
  installed: null,
  update: null,
}
const broken = {
  id: 'broken',
  manifest: null,
  valid: false,
  errors: ['version must be semver (e.g. "1.2.0")'],
  enabled: false,
  disabledReason: null,
  installed: null,
  update: null,
}
const listing = {
  addons: [planner, mine, broken],
  catalog: {
    source: 'remote',
    addons: [
      {
        id: 'planner',
        repo: 'https://x/planner.git',
        ref: null,
        name: 'Track planner',
        description: null,
        installed: true,
      },
      {
        id: 'timing',
        repo: 'https://x/timing.git',
        ref: null,
        name: { en: 'Sector timing' },
        description: 'Splits',
        installed: false,
      },
      {
        id: 'local-only',
        repo: '/srv/addons/local-only',
        ref: null,
        name: 'Local only',
        description: null,
        installed: false,
      },
    ],
  },
  overrides: { stacks: [], replacements: [], orphans: [] },
}

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body })
let requests
let actionReply

function serve(data = listing) {
  requests = []
  actionReply = (url) => reply(202, { success: true, data: { addon: url.split('/')[3] ?? null } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET'
      requests.push({ url, method, body: options.body ? JSON.parse(options.body) : undefined })
      return method === 'GET' ? reply(200, { success: true, data }) : actionReply(url)
    })
  )
}

const actions = () => requests.filter((r) => r.method !== 'GET').map(({ url, method, body }) => [method, url, body])
const listings = () => requests.filter((r) => r.method === 'GET').length
const emit = (payload) => act(() => socket.handlers['addons:progress'](payload))
const card = (id) => within(screen.getByTestId(`addon-${id}`))

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  socket.handlers = {}
  waitForRestart.mockReturnValue(new Promise(() => {}))
  serve()
})
afterEach(() => vi.unstubAllGlobals())

async function renderPage() {
  render(<Addons />)
  await screen.findByTestId('addon-planner')
}

describe('installed add-ons', () => {
  test('each with its state, source and what can be done', async () => {
    await renderPage()

    expect(card('planner').getByText('Track planner')).toBeInTheDocument()
    expect(card('planner').getByText('v0.1.0')).toBeInTheDocument()
    expect(card('planner').getByText('Enabled')).toBeInTheDocument()
    expect(card('planner').getByText('Market')).toBeInTheDocument()
    expect(card('planner').getByText('by WillibaldSoft')).toBeInTheDocument()
    expect(card('planner').getByText('Draw your track')).toBeInTheDocument()
    expect(card('planner').getByRole('button', { name: 'Update to v0.2.0' })).toBeInTheDocument()
    expect(card('planner').getByRole('button', { name: 'Disable' })).toBeInTheDocument()
    expect(card('planner').getByRole('button', { name: 'Uninstall' })).toBeInTheDocument()

    // A developer's folder: never updated or removed by the app
    expect(card('mine').getByText('Local folder')).toBeInTheDocument()
    expect(card('mine').getByText(/the app never updates or removes it/)).toBeInTheDocument()
    expect(card('mine').getByTestId('addon-disabled-reason')).toHaveTextContent(
      'Disabled: build failed: missing export'
    )
    expect(card('mine').getByRole('button', { name: 'Enable' })).toBeInTheDocument()
    expect(card('mine').queryByRole('button', { name: 'Uninstall' })).toBeNull()

    expect(card('broken').getByText('broken')).toBeInTheDocument()
    expect(card('broken').getByText('Invalid')).toBeInTheDocument()
    expect(card('broken').getByText('version must be semver (e.g. "1.2.0")')).toBeInTheDocument()
    expect(card('broken').queryByRole('button')).toBeNull()
  })

  test('names follow the interface language', async () => {
    await i18n.changeLanguage('fr')
    try {
      await renderPage()
      expect(card('planner').getByText('Éditeur de circuit')).toBeInTheDocument()
    } finally {
      await i18n.changeLanguage('en')
    }
  })

  test.each([
    ['planner', 'Update to v0.2.0', '/api/addon-manager/planner/update'],
    ['planner', 'Disable', '/api/addon-manager/planner/disable'],
    ['mine', 'Enable', '/api/addon-manager/mine/enable'],
  ])('%s: %s', async (id, button, url) => {
    await renderPage()
    await userEvent.click(card(id).getByRole('button', { name: button }))
    expect(actions()).toEqual([['POST', url, undefined]])
  })

  test('uninstall asks first, and keeps the data unless told otherwise', async () => {
    await renderPage()
    await userEvent.click(card('planner').getByRole('button', { name: 'Uninstall' }))
    const dialog = within(screen.getByTestId('modal'))
    expect(dialog.getByText('Uninstall Track planner?')).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('modal')).toBeNull()
    expect(actions()).toEqual([])

    await userEvent.click(card('planner').getByRole('button', { name: 'Uninstall' }))
    await userEvent.click(screen.getByTestId('uninstall-confirm'))
    expect(actions()).toEqual([['DELETE', '/api/addon-manager/planner', undefined]])
  })

  test('uninstall with its data', async () => {
    await renderPage()
    await userEvent.click(card('planner').getByRole('button', { name: 'Uninstall' }))
    await userEvent.click(screen.getByTestId('uninstall-delete-data'))
    await userEvent.click(screen.getByTestId('uninstall-confirm'))
    expect(actions()).toEqual([['DELETE', '/api/addon-manager/planner?delete_data=1', undefined]])
  })

  test('nothing installed', async () => {
    serve({ ...listing, addons: [] })
    render(<Addons />)
    expect(await screen.findByText('No add-on yet. Find one in the Market.')).toBeInTheDocument()
  })
})

describe('progress', () => {
  test('follows the steps, then waits for the restart; nothing else can start meanwhile', async () => {
    await renderPage()
    await userEvent.click(card('planner').getByRole('button', { name: 'Update to v0.2.0' }))

    const banner = screen.getByTestId('addon-progress')
    expect(banner).toHaveTextContent('Updating planner')
    expect(banner).toHaveTextContent('Starting…')
    expect(card('planner').getByRole('button', { name: 'Disable' })).toBeDisabled()

    emit({ action: 'update', addon: 'planner', step: 'build', status: 'running' })
    expect(banner).toHaveTextContent('Building the app…')

    emit({ action: 'update', addon: 'planner', step: 'restart', status: 'complete' })
    expect(screen.getByTestId('addon-progress')).toHaveTextContent('Done. RaceHubOS is restarting…')
    expect(waitForRestart).toHaveBeenCalled()
    expect(card('mine').getByRole('button', { name: 'Enable' })).toBeDisabled()
  })

  test('a failure shows its reason, refreshes the list and can be dismissed', async () => {
    await renderPage()
    await userEvent.click(card('mine').getByRole('button', { name: 'Enable' }))
    const before = listings()

    emit({ action: 'enable', addon: 'mine', step: 'error', status: 'error', error: 'build failed: boom' })
    const banner = screen.getByTestId('addon-progress')
    expect(banner).toHaveAttribute('data-status', 'error')
    expect(banner).toHaveTextContent('Enabling mine')
    expect(banner).toHaveTextContent('Failed: build failed: boom')
    await waitFor(() => expect(listings()).toBe(before + 1))
    expect(card('mine').getByRole('button', { name: 'Enable' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('addon-progress')).toBeNull()
  })

  test('a refused action shows the server reason at once', async () => {
    await renderPage()
    actionReply = () => reply(409, { success: false, error: 'another add-on action is running' })
    await userEvent.click(card('planner').getByRole('button', { name: 'Disable' }))
    expect(screen.getByTestId('addon-progress')).toHaveTextContent('Failed: another add-on action is running')
  })
})

describe('market', () => {
  test('the reviewed add-ons, installed in one click', async () => {
    await renderPage()
    await userEvent.click(screen.getByTestId('addons-tab-market'))

    const timing = within(screen.getByTestId('market-timing'))
    expect(timing.getByText('Sector timing')).toBeInTheDocument()
    expect(timing.getByText('Splits')).toBeInTheDocument()
    expect(timing.getByRole('link', { name: /Source code/ })).toHaveAttribute('href', 'https://x/timing.git')
    expect(within(screen.getByTestId('market-planner')).getByText('Installed')).toBeInTheDocument()
    expect(within(screen.getByTestId('market-local-only')).queryByRole('link')).toBeNull()
    expect(screen.queryByText(/GitHub can't be reached/)).toBeNull()

    await userEvent.click(timing.getByRole('button', { name: 'Install' }))
    expect(actions()).toEqual([['POST', '/api/addon-manager/install', { id: 'timing' }]])
    expect(screen.getByTestId('addon-progress')).toHaveTextContent('Installing')
  })

  test('offline: the catalog shipped with the app, maybe empty', async () => {
    serve({ ...listing, catalog: { source: 'local', addons: [] } })
    render(<Addons />)
    await userEvent.click(await screen.findByTestId('addons-tab-market'))
    expect(screen.getByText(/GitHub can't be reached/)).toBeInTheDocument()
    expect(screen.getByText('The catalog is empty for now.')).toBeInTheDocument()
  })
})

describe('install from a link', () => {
  test('warns first, then installs the repository', async () => {
    await renderPage()
    await userEvent.click(screen.getByTestId('addons-tab-link'))
    expect(screen.getByTestId('link-warning')).toHaveTextContent("This add-on hasn't been reviewed")
    expect(screen.getByTestId('link-install')).toBeDisabled()

    await userEvent.type(screen.getByTestId('link-repo'), '  https://github.com/x/racehubos-y  ')
    actionReply = () => reply(202, { success: true, data: { action: 'install', addon: null } })
    await userEvent.click(screen.getByTestId('link-install'))
    expect(actions()).toEqual([['POST', '/api/addon-manager/install', { repo: 'https://github.com/x/racehubos-y' }]])
    expect(screen.getByTestId('addon-progress')).toHaveTextContent('Installing the add-on')
  })
})

describe('override stacks', () => {
  test('each stack from the top down to the core, and the warnings', async () => {
    serve({
      ...listing,
      overrides: {
        stacks: [{ file: 'packages/frontend/src/Leaderboard.jsx', layers: ['timing', 'pits'] }],
        replacements: [
          { file: 'packages/frontend/src/Leaderboard.jsx', id: 'pits', hides: ['timing'] },
          { file: 'packages/frontend/src/Board.jsx', id: 'race', hides: [] },
        ],
        orphans: [{ id: 'timing', file: 'packages/frontend/src/Old.jsx' }],
      },
    })
    await renderPage()
    const stacks = within(screen.getByTestId('override-stacks'))
    expect(stacks.getByText('pits → timing → core')).toBeInTheDocument()
    expect(stacks.getAllByTestId('override-warning').map((w) => w.textContent)).toEqual([
      'pits replaces packages/frontend/src/Leaderboard.jsx: the changes from timing are hidden.',
      'race replaces packages/frontend/src/Board.jsx entirely.',
      'timing changes packages/frontend/src/Old.jsx, which the core no longer has: that change does nothing.',
    ])
    expect(stacks.getByText(/wrap the file with @base/)).toBeInTheDocument()
  })

  test('nothing to show without overrides', async () => {
    await renderPage()
    expect(screen.queryByTestId('override-stacks')).toBeNull()
  })
})

test('a list that cannot be loaded says so', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => reply(500, {}))
  )
  render(<Addons />)
  expect(await screen.findByText('Could not load the add-ons: HTTP 500')).toBeInTheDocument()
})

test('a request aborted by the next one does not break the page (StrictMode runs effects twice)', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, { signal } = {}) => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return reply(200, { success: true, data: listing })
    })
  )
  render(
    <StrictMode>
      <Addons />
    </StrictMode>
  )
  expect(screen.getByTestId('addons-loading')).toBeInTheDocument()
  expect(await screen.findByTestId('addon-planner')).toBeInTheDocument()
})
