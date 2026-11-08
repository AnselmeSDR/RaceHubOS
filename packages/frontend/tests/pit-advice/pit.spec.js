import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const API = 'http://127.0.0.1:3227'
const dictionaries = Object.fromEntries(
  ['fr', 'en', 'de'].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/i18n/locales', lang, 'pitAdvice.json'))),
  ])
)
for (const lang of ['fr', 'en', 'de'])
  test('pit advice is optional and configurable in ' + lang, async ({ page, request }) => {
    await request.put(API + '/api/preferences/pitAdvice:settings', { data: { value: null } })
    await page.addInitScript((value) => localStorage.setItem('racehubos-lang', value), lang)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/settings')
    const toggle = page.getByTestId('pit-advice-enabled')
    await expect(toggle).toBeEnabled()
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await page.getByRole('combobox', { name: dictionaries[lang].places, exact: true }).click()
    await page.getByRole('option', { name: '2', exact: true }).click()
    await page.getByTestId('pit-advice-save').click()
    await expect(page.getByRole('status')).toHaveText(dictionaries[lang].saved)
    expect((await (await request.get(API + '/api/preferences/pitAdvice:settings')).json()).data).toEqual({
      enabled: true,
      places: 2,
    })
    await page.reload()
    await expect(toggle).toBeChecked()
    await toggle.click()
    await page.getByTestId('pit-advice-save').click()
    await expect(page.getByRole('status')).toHaveText(dictionaries[lang].saved)
    expect((await (await request.get(API + '/api/preferences/pitAdvice:settings')).json()).data.enabled).toBe(false)
    expect(errors).toEqual([])
  })
test('live advice uses fresh status, marks zero fuel and becomes unknown after telemetry stops', async ({
  page,
  request,
}) => {
  const t = dictionaries.en
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  await request.put(API + '/api/preferences/pitAdvice:settings', { data: { value: { enabled: true, places: 1 } } })
  const track = (await (await request.post(API + '/api/tracks', { data: { name: 'Pit fixture track' } })).json()).data
  const driver = (await (await request.post(API + '/api/drivers', { data: { name: 'Pit fixture driver' } })).json())
    .data
  const car = (await (await request.post(API + '/api/cars', { data: { brand: 'Fixture', model: 'Pit car' } })).json())
    .data
  const session = (
    await (
      await request.post(API + '/api/sessions', {
        data: { name: 'Pit fixture session', trackId: track.id, type: 'race' },
      })
    ).json()
  ).data
  await request.put(API + '/api/sessions/' + session.id + '/drivers', {
    data: { drivers: [{ driverId: driver.id, carId: car.id, controller: 0 }] },
  })
  const detail = (await (await request.get(API + '/api/sessions/' + session.id)).json()).data
  await page.addInitScript((id) => {
    localStorage.setItem('racehubos-free-track', id)
    localStorage.setItem('racehubos-free-type', 'race')
  }, track.id)
  await page.goto('/race')
  await expect(page.getByTestId('session-section')).toContainText('Pit fixture session', { timeout: 20000 })
  const emit = (event, data) => request.post('http://127.0.0.1:3228', { data: { event, data } })
  await emit('race:session', { ...detail, status: 'active' })
  await emit('session:leaderboard', [{ ...detail.drivers[0], totalLaps: 5, totalTime: 40000 }])
  const panel = page.getByTestId('pit-advice-panel')
  await expect(panel).toBeVisible()
  await expect
    .poll(async () => {
      await emit('cu:connected', {})
      await emit('cu:status', { mode: 5, fuel: [0], pit: [false] })
      return await panel.getByText(t.urgent).count()
    })
    .toBe(1)
  await expect(panel).toContainText('Pit fixture driver')
  await expect(panel.getByText(t.unavailable, { exact: true })).toBeVisible({ timeout: 10000 })
  expect((await (await request.get(API + '/api/bluetooth/status')).json()).connected).toBe(false)
  expect((await (await request.get(API + '/api/sessions/' + session.id)).json()).data.status).toBe('draft')
})
