import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-ui-'))
const fixture = path.join(temporary, 'synthetic-cockpit.zip')
const database = path.resolve(import.meta.dirname, '../../backend/prisma/e2e.db')
let images = []
test.beforeAll(() =>
  execFileSync('python3', [
    path.resolve(import.meta.dirname, '../../backend/src/__tests__/fixtures/createCockpitFixture.py'),
    fixture,
  ])
)
test.afterAll(() => {
  fs.rmSync(temporary, { recursive: true, force: true })
  for (const image of images)
    fs.rmSync(path.resolve(import.meta.dirname, '../../backend/public/uploads', image), { force: true })
  fs.rmSync(path.join(path.dirname(database), 'cockpit-import-backups'), { recursive: true, force: true })
})
test('preview, confirmation, backup and labelled history preserve existing race data', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const db = new Database(database)
  const before = Object.fromEntries(
    ['Driver', 'Car', 'Session', 'Lap'].map((t) => [t, db.prepare(`SELECT count(*) n FROM ${t}`).get().n])
  )
  const setup = db.prepare("SELECT maxSpeed,brakeForce,fuelCapacity FROM Car WHERE id='e2e-c1'").get()
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  await page.goto('/settings')
  const section = page.getByRole('region', { name: 'Import Cockpit-XP data', exact: true })
  await expect(section).toBeVisible()
  await section.getByLabel('Cockpit-XP backup file').setInputFiles(fixture)
  await section.getByRole('button', { name: 'Check ZIP backup', exact: true }).click()
  await expect(section.getByText('Fixture Driver', { exact: true })).toBeVisible()
  expect(db.prepare('SELECT count(*) n FROM Driver').get().n).toBe(before.Driver)
  const submit = section.getByRole('button', { name: 'Perform confirmed import', exact: true })
  await expect(submit).toBeDisabled()
  await section.getByTestId('cockpit-import-confirm').check()
  await expect(submit).toBeEnabled()
  await section.getByLabel('Include inactive entries', { exact: true }).check()
  await expect(submit).toHaveCount(0)
  await section.getByLabel('Include inactive entries', { exact: true }).uncheck()
  await section.getByRole('button', { name: 'Check ZIP backup', exact: true }).click()
  await expect(submit).toBeDisabled()
  await section.getByTestId('cockpit-import-confirm').check()
  await submit.click()
  const download = page.getByRole('link', { name: 'Download the backup made before import' })
  await expect(download).toBeVisible()
  const response = await page.request.get(await download.getAttribute('href'))
  expect(response.ok()).toBeTruthy()
  expect(JSON.parse(await response.text()).payload.tables.Car.rows).toHaveLength(before.Car)
  expect(db.prepare('SELECT count(*) n FROM Driver').get().n).toBe(before.Driver + 1)
  for (const t of ['Session', 'Lap']) expect(db.prepare(`SELECT count(*) n FROM ${t}`).get().n).toBe(before[t])
  expect(db.prepare("SELECT maxSpeed,brakeForce,fuelCapacity FROM Car WHERE id='e2e-c1'").get()).toEqual(setup)
  const car = db.prepare("SELECT id,img FROM Car WHERE model='Fixture Car'").get(),
    driver = db.prepare("SELECT id,img FROM Driver WHERE name='Fixture Driver'").get()
  images = [car.img, driver.img].map((url) => url.replace('/api/img/', ''))
  db.close()
  await page.goto('/stats')
  await expect(page.getByRole('region', { name: 'Cockpit-XP history', exact: true })).toBeVisible()
  await page.getByText('Show historical statistics', { exact: false }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'Race results' }).getByRole('cell', { name: 'Fixture Driver', exact: true })
  ).toBeVisible()
  await page.screenshot({ path: '../../../cockpit-history-en.png', fullPage: true })
  await page.goto(`/cars/${car.id}`)
  await expect(page.getByText('Fixture motor', { exact: true })).toBeVisible()
  await page.goto(`/drivers/${driver.id}`)
  await expect(page.getByRole('region', { name: 'Cockpit-XP history', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
test('French labels work independently of the German translation branch', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'fr'))
  await page.goto('/settings')
  await expect(page.getByRole('region', { name: 'Importer les données Cockpit-XP', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vérifier la sauvegarde ZIP', exact: true })).toBeDisabled()
  await page.screenshot({ path: '../../../cockpit-import-fr.png', fullPage: true })
})
