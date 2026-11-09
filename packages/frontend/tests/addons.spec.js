import { test, expect } from '@playwright/test'

// The servers load tests/fixtures/addons (RACEHUBOS_ADDONS_DIR in playwright.config.js)

test('an add-on brings its menu entry, page, translations and API route', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-/addons/e2e-hello').click()

  await expect(page).toHaveURL(/\/addons\/e2e-hello$/)
  await expect(page.getByTestId('page-header').getByRole('heading')).toHaveText('Bonjour E2E')
  await expect(page.getByTestId('e2e-hello-greeting')).toHaveText('Bonjour depuis un add-on')
  await expect(page.getByTestId('e2e-hello-server')).toHaveText('e2e-hello')
  await expect(page.getByTestId('nav-/addons/e2e-hello')).toHaveAttribute('data-active', 'true')
})

test('a crashing add-on page shows an error, the rest of the app keeps working', async ({ page }) => {
  await page.goto('/addons/e2e-hello/crash')
  const error = page.getByTestId('addon-error')
  await expect(error).toContainText('e2e-hello')
  await expect(error).toContainText('a planté sur cette page')
  await expect(error).toContainText('e2e crash on purpose')

  await page.getByTestId('nav-/drivers').click()
  await expect(page).toHaveURL(/\/drivers$/)
  await expect(page.getByTestId('addon-error')).toHaveCount(0)
})

test('a page with layout: false is shown without the sidebar', async ({ page }) => {
  await page.goto('/addons/e2e-hello/screen')
  await expect(page.getByTestId('e2e-hello-screen')).toBeVisible()
  await expect(page.getByTestId('page-header')).toHaveCount(0)
})

test('the API of an add-on that is not there answers 404 in JSON, not the app page', async ({ request }) => {
  const res = await request.get('http://localhost:3101/api/addons/not-installed/hello')
  expect(res.status()).toBe(404)
  expect(await res.json()).toEqual({ success: false, error: 'Not found: GET /api/addons/not-installed/hello' })
})
