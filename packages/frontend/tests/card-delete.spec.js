import { test, expect } from '@playwright/test'

const API_URL = process.env.API_URL || 'http://localhost:3001'

/**
 * Deleting from a card, in grid view.
 *
 * The action used to exist only in list view, behind a row selection: the grid
 * offered no way to remove anything. The bin now arms itself into a "Confirm?"
 * button, so a single click never deletes.
 */
/** Unique per run: driver numbers and names carry unique constraints. */
const stamp = () => `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const ENTITIES = [
  { label: 'pilote',  path: '/drivers', endpoint: '/api/drivers', create: () => ({ name: stamp(), number: 700 + Math.floor(Math.random() * 299) }) },
  { label: 'voiture', path: '/cars',    endpoint: '/api/cars',    create: () => ({ brand: 'E2E', model: stamp() }) },
  { label: 'circuit', path: '/tracks',  endpoint: '/api/tracks',  create: () => ({ name: stamp(), length: 20 }) },
  { label: 'équipe',  path: '/teams',   endpoint: '/api/teams',   create: () => ({ name: stamp() }) },
]

async function apiCreate(request, endpoint, body) {
  const res = await request.post(`${API_URL}${endpoint}`, { data: body })
  expect(res.ok(), `création via ${endpoint}`).toBeTruthy()
  return (await res.json()).data
}

/** An entity is "gone" once it is soft-deleted. */
async function stillActive(request, endpoint, id) {
  const res = await request.get(`${API_URL}${endpoint}/${id}`)
  if (!res.ok()) return false
  const body = await res.json()
  return Boolean(body.success && body.data && !body.data.deletedAt)
}

async function openGridAndFindBin(page, path) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  const gridToggle = page.locator('[data-testid="view-grid"]')
  if (await gridToggle.count()) await gridToggle.click()
  await page.waitForTimeout(800)
  return page.locator('[data-testid="delete-button"]').last()
}

for (const entity of ENTITIES) {
  test.describe(`Suppression depuis la carte — ${entity.label}`, () => {
    test('un seul clic arme le bouton sans rien supprimer', async ({ page, request }) => {
      const created = await apiCreate(request, entity.endpoint, entity.create())

      const bin = await openGridAndFindBin(page, entity.path)
      await expect(bin).toBeVisible()
      await bin.click()

      // the button turned into a confirmation, and nothing was deleted yet
      await expect(page.locator('[data-testid="delete-button"][data-armed="true"]').last()).toBeVisible()
      expect(await stillActive(request, entity.endpoint, created.id), 'intact avant confirmation').toBeTruthy()

      await request.delete(`${API_URL}${entity.endpoint}/${created.id}`)
    })

    test('le second clic supprime', async ({ page, request }) => {
      const created = await apiCreate(request, entity.endpoint, entity.create())

      const bin = await openGridAndFindBin(page, entity.path)
      await bin.click()
      await page.locator('[data-testid="delete-button"][data-armed="true"]').last().click()
      await page.waitForTimeout(1200)

      expect(await stillActive(request, entity.endpoint, created.id), 'supprimé après confirmation').toBeFalsy()
    })

    test('le bouton se désarme quand la souris quitte la carte', async ({ page, request }) => {
      const created = await apiCreate(request, entity.endpoint, entity.create())

      const bin = await openGridAndFindBin(page, entity.path)
      await bin.click()
      await expect(page.locator('[data-testid="delete-button"][data-armed="true"]').last()).toBeVisible()

      await page.mouse.move(0, 0)
      await page.waitForTimeout(400)

      await expect(page.locator('[data-testid="delete-button"][data-armed="true"]')).toHaveCount(0)
      expect(await stillActive(request, entity.endpoint, created.id), 'toujours intact').toBeTruthy()

      await request.delete(`${API_URL}${entity.endpoint}/${created.id}`)
    })
  })
}
