import { test, expect } from '@playwright/test'

// Served by the Playwright-managed backend, on its own throwaway database
const API_URL = 'http://localhost:3101'
const stamp = () => `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`

async function apiCreate(request, endpoint, body) {
  const res = await request.post(`${API_URL}${endpoint}`, { data: body })
  expect(res.ok(), `création via ${endpoint}`).toBeTruthy()
  return (await res.json()).data
}

/**
 * A championship planned by hand, with the browser's own drag and drop: the cars come from the
 * drivers' profiles, a driver moved between practices shows where they land, a driver is set aside
 * by dragging, a session moves by its header.
 */
test('manual championship: cars from the profiles, drivers and sessions dragged', async ({ page, request }) => {
  const run = stamp()
  // Ana and Cid prefer the same BMW: the wizard never puts them in the same session
  const [ana, ben, cid] = await Promise.all(
    [
      { name: `Ana ${run}`, preferredCarId: 'e2e-c1' },
      { name: `Ben ${run}` },
      { name: `Cid ${run}`, preferredCarId: 'e2e-c1' },
    ].map((driver) => apiCreate(request, '/api/drivers', driver))
  )
  const name = `Championnat ${run}`

  await page.goto('/championships')
  await page.getByTestId('page-add').click()
  const modal = page.getByTestId('modal')
  await modal.getByRole('textbox').first().fill(name)
  await modal.getByRole('combobox').selectOption('e2e-track')
  await modal.getByRole('button', { name: 'Suivant', exact: true }).click()

  for (const driver of [ana, ben, cid]) {
    await modal.getByRole('combobox', { name: 'Pilote', exact: true }).last().selectOption(driver.id)
  }
  await expect(modal.getByText('★ Profil')).toHaveCount(2)
  await modal.getByRole('button', { name: 'Suivant', exact: true }).click()

  // Three drivers fit one session of each, but Ana and Cid share the BMW: two of each
  const practices = modal.getByTestId('championship-wizard-practice')
  const groups = modal.getByTestId('championship-wizard-qualif-group')
  await expect(practices).toHaveCount(2)
  await expect(groups).toHaveCount(2)
  for (const group of [...(await practices.all()), ...(await groups.all())]) {
    await expect(group.getByText(/^(Ana|Cid) /)).toHaveCount(1)
  }
  await expect(modal.getByTestId('championship-wizard-race-group')).toHaveCount(2)

  // Ben dragged from EL1 to EL2: EL2 shows where he lands while hovered
  await practices.nth(0).getByText(`Ben ${run}`).hover()
  await page.mouse.down()
  const fp2 = practices.nth(1)
  const box = await fp2.boundingBox()
  // Moved by steps: a single jump fires no dragover
  await page.mouse.move(box.x + 20, box.y + 12, { steps: 5 })
  await page.mouse.move(box.x + 40, box.y + 14, { steps: 5 })
  await expect(fp2.getByTestId('wizard-drop-ghost')).toHaveText(`+Ben ${run}`)
  await page.mouse.up()
  await expect(fp2.getByTestId('wizard-driver')).toHaveCount(2)
  await expect(fp2.getByTestId('wizard-drop-ghost')).toHaveCount(0)

  await modal.getByRole('radio', { name: 'Manuel' }).click()
  const lanes = modal.getByTestId('championship-wizard-session')
  await expect(lanes).toHaveCount(6)
  // Dragged out of Q1, the driver still runs a practice and the race: not set aside
  const qualif = lanes.nth(2)
  await qualif.getByTestId('wizard-driver').first().dragTo(modal.getByTestId('championship-wizard-bench'))
  await expect(qualif.getByTestId('wizard-driver')).toHaveCount(1)
  await expect(modal.getByTestId('championship-wizard-bench').getByTestId('wizard-driver')).toHaveCount(0)
  // The race goes before the qualifying sessions
  await lanes.nth(4).locator('[draggable]').first().dragTo(lanes.nth(2).locator('[draggable]').first())
  await expect(lanes.nth(2)).toContainText('R1')

  await modal.getByRole('button', { name: 'Créer le championnat' }).click()
  await expect(modal).toBeHidden()

  const list = await (await request.get(`${API_URL}/api/championships?limit=1000`)).json()
  const created = list.data.find((c) => c.name === name)
  const detail = (await (await request.get(`${API_URL}/api/championships/${created.id}`)).json()).data
  expect(detail.mode).toBe('manual')
  const sessions = detail.sessions.toSorted((a, b) => a.order - b.order)
  expect(sessions.map((s) => s.type)).toEqual(['practice', 'practice', 'race', 'qualif', 'qualif', 'race'])
  expect(sessions.map((s) => s.drivers.length)).toEqual([1, 2, 2, 1, 1, 1])
  // Each driver runs the car of their profile, Ben none
  const carOf = Object.fromEntries(detail.participants.map((p) => [p.driverId, p.carId]))
  expect(carOf).toEqual({ [ana.id]: 'e2e-c1', [ben.id]: null, [cid.id]: 'e2e-c1' })
  for (const driver of sessions.flatMap((s) => s.drivers)) {
    expect(driver.carId).toBe(carOf[driver.driverId])
  }
})
