import { test, expect } from '@playwright/test'

// Served by the Playwright-managed backend, on its own throwaway database
const API_URL = 'http://localhost:3101'

test('a division opens from its card; a driver joins and leaves it from there', async ({ page, request }) => {
  const name = `E2E-${Date.now()}`
  const created = await request.post(`${API_URL}/api/divisions`, { data: { name, scope: 'driver' } })
  const division = (await created.json()).data

  await page.goto('/divisions')
  const gridToggle = page.getByTestId('view-grid')
  if (await gridToggle.count()) await gridToggle.click()
  await page.locator(`[data-testid="entity-card"][data-entity-id="${division.id}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/divisions/${division.id}$`))
  await expect(page.getByTestId('division-identity')).toContainText(name)

  const members = page.getByTestId('division-members')
  await members.getByRole('combobox').selectOption('e2e-d1')
  await expect(members.getByTestId('division-member')).toHaveCount(1)
  // The driver's own profile now shows the division
  expect((await (await request.get(`${API_URL}/api/drivers/e2e-d1`)).json()).data.divisions).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: division.id })])
  )

  await members.getByTestId('division-member').getByRole('button').click()
  await expect(members.getByTestId('division-member')).toHaveCount(0)
})
