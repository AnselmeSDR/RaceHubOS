import { test, expect } from '@playwright/test'
const API = 'http://localhost:3101'
async function preference(request, key) {
  return (await (await request.get(`${API}/api/preferences/${key}`)).json()).data
}
test.beforeEach(async ({ page, request }) => {
  await request.put(`${API}/api/preferences/raceScreenLayout`, { data: { value: null } })
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  page.on('pageerror', (e) => console.log('RACE SCREEN BROWSER ERROR:', e.message))
})
test('named screens are saved independently, activated explicitly and restored after reload', async ({
  page,
  request,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/settings/race-screen')
  const profiles = page.getByRole('combobox', { name: 'Saved race screen', exact: true })
  await expect(profiles).toBeEnabled()
  await expect(profiles).toHaveValue('sectors-and-pit')
  await profiles.selectOption('bisheriger-rennbildschirm')
  await page.getByRole('textbox', { name: 'Race screen name', exact: true }).fill('Fixture TV')
  await page.getByRole('button', { name: 'Save as another template', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Race screen saved.')
  let stored = await preference(request, 'raceScreenLayout')
  expect(stored.profiles).toHaveLength(3)
  expect(stored.activeProfile).toBe('sectors-and-pit')
  const copied = stored.profiles.find((p) => p.name === 'Fixture TV').id
  await page.getByRole('button', { name: 'Save and use for racing', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Race screen saved and selected for racing.')
  expect((await preference(request, 'raceScreenLayout')).activeProfile).toBe(copied)
  await page.reload()
  await expect(profiles).toHaveValue(copied)
  expect(errors).toEqual([])
})
test('one row edits all 1–6 driver previews; drag, resize and visibility remain unsaved', async ({ page, request }) => {
  const mutations = []
  page.on('request', (r) => {
    if (r.method() !== 'GET') mutations.push(r.url())
  })
  await page.goto('/settings/race-screen')
  const count = page.getByRole('combobox', { name: 'Drivers in preview', exact: true })
  await expect(page.getByRole('button', { name: 'Save race screen', exact: true })).toBeEnabled()
  const canvas = page.getByTestId('race-screen-canvas')
  for (let n = 1; n <= 6; n++) {
    await count.selectOption(String(n))
    await expect(canvas.getByTestId(/^race-driver-row-/)).toHaveCount(n)
  }
  const x = page.getByRole('spinbutton', { name: 'Driver name: Left (%)', exact: true })
  await x.fill('18')
  await x.press('Tab')
  for (let n = 1; n <= 6; n++)
    await expect(canvas.getByTestId(`race-driver-row-${n}`).getByTestId('race-widget-name')).toHaveCSS('left', /px$/)
  const positions = await canvas.getByTestId('race-widget-name').evaluateAll((nodes) => nodes.map((n) => n.style.left))
  expect(new Set(positions)).toEqual(new Set(['18%']))
  const first = canvas.getByTestId('race-driver-row-1').getByTestId('race-widget-name')
  await first.scrollIntoViewIfNeeded()
  let b = await first.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 2, { steps: 4 })
  await page.mouse.up()
  expect(Number(await x.inputValue())).toBeGreaterThan(18)
  const width = page.getByRole('spinbutton', { name: 'Driver name: Width (%)', exact: true })
  const oldWidth = Number(await width.inputValue())
  const corner = first.getByTestId('race-resize-name')
  b = await corner.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 2, { steps: 4 })
  await page.mouse.up()
  expect(Number(await width.inputValue())).toBeGreaterThan(oldWidth)
  await page.getByLabel('Show: Driver name', { exact: true }).uncheck()
  await expect(canvas.getByTestId('race-widget-name')).toHaveCount(0)
  expect(await preference(request, 'raceScreenLayout')).toBeNull()
  expect(mutations).toEqual([])
})
test('preview and start-light test send no session/hardware requests and Esc restores the controls', async ({
  page,
}) => {
  const writes = []
  page.on('request', (r) => {
    if (r.method() !== 'GET') writes.push(r.url())
  })
  await page.goto('/settings/race-screen')
  await expect(page.getByRole('button', { name: 'Save race screen', exact: true })).toBeEnabled()
  await page.getByLabel('Open fullscreen', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Fullscreen preview', exact: true }).click()
  await expect(page.getByTestId('race-screen-dialog')).toBeVisible()
  await page.screenshot({ path: '../../../race-screen-preview-en.png', fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Test start lights', exact: true }).click()
  await expect(page.getByTestId('race-screen-dialog').getByTestId('race-widget-lights')).toBeVisible()
  await page.getByRole('button', { name: 'Back to controls · Esc', exact: true }).click()
  await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
  expect(writes).toEqual([])
})
test('French controls and the sector/pit preset render without German fallback', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'fr'))
  await page.goto('/settings/race-screen')
  await expect(page.getByRole('heading', { name: 'Personnaliser l’écran de course', exact: true })).toBeVisible()
  await expect(page.getByTestId('race-screen-canvas').getByTestId('race-widget-sectors')).toHaveCount(6)
  await page.screenshot({ path: '../../../race-screen-editor-fr.png', fullPage: true })
})
test('session activation opens the screen; closing preserves controls and auto-open opt-out is respected', async ({
  page,
  request,
}) => {
  const created = await request.post(`${API}/api/sessions`, {
    data: { name: 'Race screen lifecycle fixture', type: 'race', trackId: 'e2e-track' },
  })
  expect(created.ok()).toBeTruthy()
  const id = (await created.json()).data.id
  await request.put(`${API}/api/sessions/${id}/drivers`, {
    data: {
      drivers: [
        { driverId: 'e2e-d1', carId: 'e2e-c1', controller: 0 },
        { driverId: 'e2e-d2', carId: 'e2e-c2', controller: 1 },
      ],
    },
  })
  const session = (await (await request.get(`${API}/api/sessions/${id}`)).json()).data
  const connection = await request.post(`${API}/api/bluetooth/connect`, { data: { address: 'SIMULATOR' } })
  expect(connection.ok()).toBeTruthy()

  const { normalizeScreens } = await import('../src/lib/raceScreen.mjs')
  const layout = normalizeScreens(null)
  for (const p of layout.profiles) p.layout.fullscreen = false
  await request.put(`${API}/api/preferences/raceScreenLayout`, { data: { value: layout } })
  await page.addInitScript(() => {
    localStorage.setItem('racehubos-free-track', 'e2e-track')
    localStorage.setItem('racehubos-free-type', 'race')
  })
  await page.route('**/api/bluetooth/status', (route) =>
    route.fulfill({
      json: {
        connected: true,
        deviceType: 'simulator',
        lastStatus: { start: 0, mode: 5, fuel: [4, 2], pit: [false, false] },
        lastStatusAt: Date.now(),
        serverTime: Date.now(),
      },
    })
  )
  await page.route(`**/api/sessions/${id}/start`, (route) =>
    route.fulfill({
      json: { success: true, data: { ...session, status: 'active', startedAt: new Date().toISOString() } },
    })
  )
  await page.goto('/race')
  await expect(page.getByTestId('session-section')).toContainText('Race screen lifecycle fixture', { timeout: 20000 })
  const start = page.getByRole('button', { name: 'Start', exact: true })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByTestId('race-screen-dialog')).toBeVisible()
  await expect(page.getByTestId('race-screen-dialog').getByTestId('race-driver-row-1')).toContainText('Pilote Un')
  await page.getByRole('button', { name: 'Back to controls · Esc', exact: true }).click()
  await expect(start).toHaveCount(0)
  await expect(page.getByTestId('session-section')).toContainText('Race screen lifecycle fixture')
  // Only the UI action response is simulated; no actual race was started.
  expect((await (await request.get(`${API}/api/sessions/${id}`)).json()).data.status).toBe('draft')
  for (const p of layout.profiles) p.layout.autoOpen = false
  await request.put(`${API}/api/preferences/raceScreenLayout`, { data: { value: layout } })
  await page.reload()
  await expect(start).toBeEnabled()
  await start.click()
  await expect(start).toHaveCount(0)
  await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
  await request.post(`${API}/api/bluetooth/disconnect`)
})
test('a refused fullscreen request leaves a closable preview and explains the fallback', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: () => Promise.reject(new Error('Fixture fullscreen refusal')),
    })
  )
  await page.goto('/settings/race-screen')
  await expect(page.getByRole('button', { name: 'Fullscreen preview', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Fullscreen preview', exact: true }).click()
  const dialog = page.getByTestId('race-screen-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText('For fullscreen, press “Enable fullscreen”.')
  await page.getByRole('button', { name: 'Back to controls · Esc', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})
