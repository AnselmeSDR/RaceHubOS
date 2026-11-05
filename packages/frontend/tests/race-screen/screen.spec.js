import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const API = 'http://127.0.0.1:3221'
const dictionaries = Object.fromEntries(
  ['fr', 'en', 'de'].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/i18n/locales', lang, 'raceScreens.json'))),
  ])
)
test.beforeEach(async ({ request }) => {
  await request.put(API + '/api/preferences/raceScreen:settings', { data: { value: null } })
})
for (const lang of ['fr', 'en', 'de'])
  test('dedicated editor, optional settings, profile and preview in ' + lang, async ({ page, request }) => {
    const t = dictionaries[lang]
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('racehubos-lang', value), lang)
    await page.goto('/settings/race-screen')
    await expect(page.getByRole('heading', { name: t.editor, exact: true })).toBeVisible()
    for (const key of ['enabled', 'autoOpen', 'fullscreen'])
      await expect(page.getByTestId('race-screen-' + key)).not.toBeChecked()
    const canvas = page.getByTestId('race-screen-canvas')
    await expect(canvas.getByTestId(/^race-driver-row-/)).toHaveCount(6)
    await page.getByRole('textbox', { name: t.profileName, exact: true }).fill('My TV ' + lang)
    await page.getByTestId('race-screen-enabled').click()
    await page.getByTestId('race-screen-save').click()
    await expect(page.getByRole('status')).toHaveText(t.saved)
    const stored = (await (await request.get(API + '/api/preferences/raceScreen:settings')).json()).data
    expect(stored.enabled).toBe(true)
    expect(stored.autoOpen).toBe(false)
    expect(stored.fullscreen).toBe(false)
    const writes = []
    page.on('request', (req) => {
      if (!['GET', 'HEAD'].includes(req.method())) writes.push(req.url())
    })
    await page.getByRole('button', { name: t.preview, exact: true }).click()
    await expect(page.getByTestId('race-screen-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
    expect(writes).toEqual([])
    await page.reload()
    await expect(page.getByRole('textbox', { name: t.profileName, exact: true })).toHaveValue('My TV ' + lang)
    expect(errors).toEqual([])
  })
test('shared row geometry, dragging, resizing, visibility and 1–6 preview stay unsaved', async ({ page, request }) => {
  const t = dictionaries.en
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  await page.goto('/settings/race-screen')
  await expect(page.getByTestId('race-screen-save')).toBeEnabled()
  const canvas = page.getByTestId('race-screen-canvas')
  for (let count = 1; count <= 6; count++) {
    await page.getByRole('combobox', { name: t.driverCount, exact: true }).click()
    await page.getByRole('option', { name: String(count), exact: true }).click()
    await expect(canvas.getByTestId(/^race-driver-row-/)).toHaveCount(count)
  }
  const x = page.getByRole('spinbutton', { name: t.x, exact: true })
  await x.fill('18')
  await x.press('Tab')
  expect(
    new Set(await canvas.getByTestId('race-widget-name').evaluateAll((nodes) => nodes.map((node) => node.style.left)))
  ).toEqual(new Set(['18%']))
  const first = canvas.getByTestId('race-driver-row-1').getByTestId('race-widget-name')
  await first.scrollIntoViewIfNeeded()
  let box = await first.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 2, { steps: 4 })
  await page.mouse.up()
  expect(Number(await x.inputValue())).toBeGreaterThan(18)
  const width = page.getByRole('spinbutton', { name: t.w, exact: true })
  const oldWidth = Number(await width.inputValue())
  box = await first.getByTestId('race-resize-name').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 2, { steps: 4 })
  await page.mouse.up()
  expect(Number(await width.inputValue())).toBeGreaterThan(oldWidth)
  await page.getByRole('checkbox', { name: t.visible, exact: true }).click()
  await expect(canvas.getByTestId('race-widget-name')).toHaveCount(0)
  expect((await (await request.get(API + '/api/preferences/raceScreen:settings')).json()).data).toBeNull()
})
test('Settings opens the saved live view only when enabled; denied fullscreen remains closable', async ({
  page,
  request,
}) => {
  const t = dictionaries.en
  await page.addInitScript(() => {
    localStorage.setItem('racehubos-lang', 'en')
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Denied for test'))
  })
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: t.openLive, exact: true })).toBeDisabled()
  await page.getByRole('link', { name: t.editor, exact: true }).click()
  await page.getByTestId('race-screen-enabled').click()
  await page.getByTestId('race-screen-save').click()
  await expect(page.getByRole('status')).toHaveText(t.saved)
  await page.getByRole('link', { name: t.back, exact: true }).click()
  await expect(page.getByRole('button', { name: t.openLive, exact: true })).toBeEnabled()
  await page.getByRole('button', { name: t.openLive, exact: true }).click()
  await expect(page.getByTestId('race-screen-dialog')).toBeVisible()
  await page.getByRole('button', { name: t.fullscreen, exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(t.fullscreenDenied)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
  expect((await (await request.get(API + '/api/preferences/raceScreen:settings')).json()).data.autoOpen).toBe(false)
})
test('session activation obeys enabled and auto-open independently without starting real hardware', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  const track = (await (await request.post(API + '/api/tracks', { data: { name: 'Screen lifecycle track' } })).json())
    .data
  const driver = (
    await (await request.post(API + '/api/drivers', { data: { name: 'Screen lifecycle driver' } })).json()
  ).data
  const car = (await (await request.post(API + '/api/cars', { data: { brand: 'Fixture', model: 'Lifecycle' } })).json())
    .data
  const session = (
    await (
      await request.post(API + '/api/sessions', {
        data: { name: 'Race screen lifecycle fixture', type: 'race', trackId: track.id },
      })
    ).json()
  ).data
  await request.put(API + '/api/sessions/' + session.id + '/drivers', {
    data: { drivers: [{ driverId: driver.id, carId: car.id, controller: 0 }] },
  })
  const detail = (await (await request.get(API + '/api/sessions/' + session.id)).json()).data
  await request.post(API + '/api/bluetooth/connect', { data: { address: 'SIMULATOR' } })
  await page.addInitScript((id) => {
    localStorage.setItem('racehubos-free-track', id)
    localStorage.setItem('racehubos-free-type', 'race')
  }, track.id)
  await page.route('**/api/bluetooth/status', (route) =>
    route.fulfill({
      json: { connected: true, deviceType: 'simulator', lastStatus: { start: 0, mode: 5, fuel: [8], pit: [false] } },
    })
  )
  await page.route(`**/api/sessions/${session.id}/start`, (route) =>
    route.fulfill({
      json: { success: true, data: { ...detail, status: 'active', startedAt: new Date().toISOString() } },
    })
  )
  const { normalizeScreens } = await import('../../src/lib/raceScreen.js')
  try {
    for (const [enabled, autoOpen, expected] of [
      [true, true, true],
      [false, true, false],
      [true, false, false],
    ]) {
      await request.put(API + '/api/preferences/raceScreen:settings', {
        data: { value: { ...normalizeScreens(null), enabled, autoOpen } },
      })
      await page.goto('/race')
      await expect(page.getByTestId('session-section')).toContainText('Race screen lifecycle fixture', {
        timeout: 20000,
      })
      const start = page.getByRole('button', { name: 'Start', exact: true })
      await expect(start).toBeEnabled()
      await start.click()
      await expect(start).toHaveCount(0)
      if (expected) {
        await expect(page.getByTestId('race-screen-dialog')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
      } else await expect(page.getByTestId('race-screen-dialog')).toHaveCount(0)
      expect((await (await request.get(API + '/api/sessions/' + session.id)).json()).data.status).toBe('draft')
    }
  } finally {
    await request.post(API + '/api/bluetooth/disconnect')
  }
})
