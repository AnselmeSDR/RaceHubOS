import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const API = 'http://127.0.0.1:3224'
const dictionaries = Object.fromEntries(
  ['fr', 'en', 'de'].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/i18n/locales', lang, 'sectorTiming.json'))),
  ])
)
for (const lang of ['fr', 'en', 'de'])
  test('optional sector display with stored and missing splits in ' + lang, async ({ page, request }) => {
    const t = dictionaries[lang]
    await request.put(API + '/api/sector-timing', { data: { enabled: false } })
    await page.addInitScript((value) => localStorage.setItem('racehubos-lang', value), lang)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/settings')
    await expect(page.getByTestId('sector-enabled')).not.toBeChecked()
    await page.getByTestId('sector-enabled').click()
    await expect(page.getByTestId('sector-enabled')).toBeChecked()
    expect((await (await request.get(API + '/api/sector-timing')).json()).data.enabled).toBe(true)
    const session = {
      id: 'historical-fixture',
      name: 'Historical fixture',
      type: 'race',
      status: 'finished',
      createdAt: '2026-01-01T00:00:00Z',
      track: { name: 'Fixture track' },
      drivers: [
        {
          id: 'result',
          controller: 0,
          driver: { id: 'driver', name: 'Fixture driver', color: '#123456' },
          car: { id: 'car', brand: 'Fixture', model: 'Car' },
          totalLaps: 1,
          totalTime: 9000,
          bestLapTime: 9000,
          lastLapTime: 9000,
          finalPos: 1,
        },
      ],
      laps: [
        {
          controller: 0,
          lapNumber: 1,
          lapTime: 9000,
          sector1: 2000,
          sector2: 3000,
          sector3: 4000,
          driver: { name: 'Fixture driver' },
          timestamp: '2026-01-01T00:00:09Z',
        },
      ],
    }
    await page.route('**/api/sessions/historical-fixture', (route) =>
      route.fulfill({ json: { success: true, data: session } })
    )
    await page.goto('/sessions/historical-fixture')
    const panel = page.getByTestId('sector-panel')
    await expect(panel).toHaveCount(1)
    await expect(panel).toContainText(t.title)
    await expect(panel).toContainText('2.000')
    await expect(panel).toContainText('4.000')
    session.laps[0].sector1 = null
    session.laps[0].sector2 = null
    session.laps[0].sector3 = null
    await page.reload()
    await expect(panel).toContainText('--')
    await request.put(API + '/api/sector-timing', { data: { enabled: false } })
    await page.reload()
    await expect(panel).toHaveCount(0)
    expect(errors).toEqual([])
  })
