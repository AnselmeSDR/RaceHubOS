import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createCockpitFixture } from '../../../backend/src/__tests__/fixtures/createCockpitFixture.js'

const database = path.resolve(import.meta.dirname, '../../../backend/prisma/cockpit-e2e.db')
const dictionaries = Object.fromEntries(
  ['fr', 'en', 'de'].map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../src/i18n/locales', lang, 'cockpit.json'))),
  ])
)
test.beforeEach(() => {
  if (!database.endsWith('/cockpit-e2e.db')) throw new Error('Unexpected browser database')
  const db = new Database(database)
  for (const table of ['CockpitImportRecord', 'Lap', 'SessionDriver', 'Session', 'Driver', 'Car', 'Track'])
    db.prepare(`DELETE FROM "${table}"`).run()
  db.close()
})
for (const lang of ['fr', 'en', 'de'])
  test('editable tabbed Node import in ' + lang, async ({ page, request }) => {
    const t = dictionaries[lang]
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((value) => localStorage.setItem('racehubos-lang', value), lang)
    await page.goto('/import')
    await expect(page.getByRole('heading', { name: t.title, exact: true })).toBeVisible()
    await page
      .getByTestId('cockpit-file')
      .setInputFiles({ name: 'synthetic.zip', mimeType: 'application/zip', buffer: await createCockpitFixture() })
    await page.getByTestId('cockpit-preview').click()
    await expect(page.getByTestId('cockpit-row-drivers')).toHaveCount(2)
    await page.getByTestId('cockpit-row-drivers').nth(1).getByRole('button', { name: t.remove, exact: true }).click()
    await page.getByTestId('cockpit-tab-cars').click()
    const car = page.getByTestId('cockpit-row-cars')
    await expect(car.getByRole('textbox', { name: t.fields.brand, exact: true })).toHaveValue('')
    await expect(car.getByRole('spinbutton', { name: t.fields.maxSpeed, exact: true })).toHaveValue('100')
    await car.getByRole('textbox', { name: t.fields.brand, exact: true }).fill('Custom maker')
    await car.getByRole('textbox', { name: t.fields.model, exact: true }).fill('Reviewed model ' + lang)
    await car.getByRole('spinbutton', { name: t.fields.year, exact: true }).fill('1888')
    for (const group of ['tracks', 'sessions', 'results', 'laps']) {
      await page.getByTestId('cockpit-tab-' + group).click()
      await expect(page.getByTestId('cockpit-row-' + group)).toHaveCount(1)
    }
    await expect(page.getByTestId('cockpit-import')).toBeDisabled()
    await page.getByTestId('cockpit-confirm').click()
    await page.getByTestId('cockpit-import').click()
    await expect(page.getByRole('status')).toContainText(t.done.split('{{backup}}')[0])
    const cars = (await (await request.get('http://127.0.0.1:3218/api/cars')).json()).data
    expect(cars).toHaveLength(1)
    expect(cars[0]).toMatchObject({ brand: 'Custom maker', model: 'Reviewed model ' + lang, year: 1888, maxSpeed: 100 })
    const sessions = (await (await request.get('http://127.0.0.1:3218/api/sessions')).json()).data
    expect(sessions).toHaveLength(1)
    expect(sessions[0].status).toBe('finished')
    const db = new Database(database, { readonly: true })
    expect(db.prepare('SELECT COUNT(*) AS n FROM Lap').get().n).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS n FROM Driver').get().n).toBe(1)
    db.close()
    expect(errors).toEqual([])
  })
