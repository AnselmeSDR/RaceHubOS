import { MANAGER_URL, startAddonAction, waitForRestart } from './api'

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body })

describe('startAddonAction', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn(async () => reply(202, { success: true, data: { action: 'x', addon: 'hello' } }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  test.each([
    ['install', { id: 'hello' }, `${MANAGER_URL}/install`, 'POST', { id: 'hello' }],
    ['install', { repo: 'https://x/a.git' }, `${MANAGER_URL}/install`, 'POST', { repo: 'https://x/a.git' }],
    ['update', { id: 'hello' }, `${MANAGER_URL}/hello/update`, 'POST', undefined],
    ['enable', { id: 'hello' }, `${MANAGER_URL}/hello/enable`, 'POST', undefined],
    ['disable', { id: 'hello' }, `${MANAGER_URL}/hello/disable`, 'POST', undefined],
    ['uninstall', { id: 'hello' }, `${MANAGER_URL}/hello`, 'DELETE', undefined],
    ['uninstall', { id: 'hello', deleteData: true }, `${MANAGER_URL}/hello?delete_data=1`, 'DELETE', undefined],
  ])('%s %o → %s %s', async (action, params, url, method, body) => {
    expect(await startAddonAction(action, params)).toEqual({ action: 'x', addon: 'hello' })
    const [calledUrl, options] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe(url)
    expect(options.method).toBe(method)
    expect(options.body ? JSON.parse(options.body) : undefined).toEqual(body)
  })

  test("a refusal carries the server's reason", async () => {
    fetchMock.mockResolvedValue(reply(409, { success: false, error: '"hello" is already installed' }))
    await expect(startAddonAction('install', { id: 'hello' })).rejects.toThrow('"hello" is already installed')
  })

  test('an answer that is not JSON gives its status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => JSON.parse('<html>') })
    await expect(startAddonAction('enable', { id: 'hello' })).rejects.toThrow('HTTP 502')
  })
})

describe('waitForRestart', () => {
  const sequence = (...states) => {
    const fetchImpl = vi.fn(async () => {
      const state = states.length > 1 ? states.shift() : states[0]
      if (state === 'throw') throw new Error('refused')
      return { ok: state === 'up' }
    })
    return fetchImpl
  }
  const wait = vi.fn(async () => {})

  test('waits for the server to go down, then to come back', async () => {
    const fetchImpl = sequence('up', 'up', 'throw', 'down', 'up')
    await waitForRestart({ fetchImpl, wait })
    expect(fetchImpl).toHaveBeenCalledTimes(5)
    expect(fetchImpl).toHaveBeenCalledWith('/api')
  })

  test('a restart too quick to be seen: back after the timeout', async () => {
    const fetchImpl = sequence('up')
    await waitForRestart({ fetchImpl, wait, interval: 1000, downTimeout: 3000 })
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  test('waits with real timers by default', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = sequence('down', 'up')
      const done = waitForRestart({ fetchImpl, interval: 10 })
      await vi.advanceTimersByTimeAsync(10)
      await done
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
