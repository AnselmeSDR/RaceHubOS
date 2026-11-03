import { test, expect } from '@playwright/test'

const API = 'http://localhost:3101'
test.beforeEach(async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('racehubos-lang', 'en'))
  for (const [key, value] of Object.entries({
    'viewMode:cars': 'list',
    'columns:cars': {},
    'order:cars': ['select', 'scale', 'brand', 'model'],
  }))
    await request.put(`${API}/api/preferences/${key}`, { data: { value } })
})

test('header filter offers scales beyond the first page, supports multiple values and clearing', async ({
  page,
  request,
}) => {
  await Promise.all(
    Array.from({ length: 51 }, (_, index) =>
      request.post(`${API}/api/cars`, {
        data: { brand: 'A first page', model: `Car ${index}`, scale: '1:32' },
      })
    )
  )
  for (const [scale, model] of [
    ['1:24', 'Scale 24'],
    ['1:43', 'Scale 43'],
  ]) {
    expect((await request.post(`${API}/api/cars`, { data: { brand: 'Z later page', model, scale } })).ok()).toBeTruthy()
  }
  await page.goto('/cars')
  await page.getByTestId('filter-scale').waitFor()
  await expect(page.getByTestId('list-row')).toHaveCount(50)
  await page.getByTestId('filter-scale').click()
  await expect(page.getByTestId('filter-scale-option-1:43')).toBeVisible()
  await page.getByTestId('filter-scale-option-1:43').click()
  await expect(page.getByTestId('list-row')).toHaveCount(1)
  await expect(page.getByTestId('list-row')).toContainText('Scale 43')
  // The menu and options remain available after filtering to one scale.
  const multiRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/cars' && url.searchParams.get('scale') === '1:43,1:24'
  })
  await page.getByTestId('filter-scale-option-1:24').click()
  await multiRequest
  await expect(page.getByTestId('list-row')).toHaveCount(2)
  await page.getByTestId('filter-scale-all').click()
  await expect(page.getByTestId('list-row')).toHaveCount(50)
  await page.keyboard.press('Escape')
  await page.getByTestId('filter-scale').click()
  await page.getByTestId('filter-scale-option-1:43').click()
  await page.keyboard.press('Escape')
  await page.getByTestId('view-grid').click()
  await expect(page.getByText('Scale 43', { exact: true })).toBeVisible()
  await expect(page.getByText('Scale 24', { exact: true })).toBeHidden()
})

test('scale is a normal column: saved order, hiding and showing, sorting', async ({ page, request }) => {
  const renderWarnings = []
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Cannot update a component'))
      renderWarnings.push(message.text())
  })
  await page.goto('/cars')
  const headers = page.locator('[data-testid^="column-header-"]')
  await expect(headers.nth(1)).toHaveAttribute('data-testid', 'column-header-scale')
  await page.getByTestId('table-columns').click()
  await page.getByTestId('column-toggle-scale').click()
  await expect(page.getByTestId('column-header-scale')).toBeHidden()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByTestId('column-header-scale')).toBeHidden()
  await page.getByTestId('table-columns').click()
  await page.getByTestId('column-toggle-scale').click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('column-header-scale')).toBeVisible()
  const sorted = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/cars' && url.searchParams.get('sortBy') === 'scale'
  })
  await page.getByTestId('column-header-scale').getByText('Scale', { exact: true }).click()
  await sorted
  const prefs = await (await request.get(`${API}/api/preferences/order:cars`)).json()
  expect(prefs.data.indexOf('scale')).toBeLessThan(prefs.data.indexOf('brand'))
  expect(renderWarnings).toEqual([])
})

test('a delayed old filter response cannot overwrite the newer selection', async ({ page, request }) => {
  for (const scale of ['RACE-A', 'RACE-B']) {
    await request.post(`${API}/api/cars`, { data: { brand: 'Race test', model: scale, scale } })
  }
  await page.goto('/cars')
  await page.getByTestId('filter-scale').click()
  let releaseOld
  const oldGate = new Promise((resolve) => {
    releaseOld = resolve
  })
  await page.route('**/api/cars?*', async (route) => {
    const response = await route.fetch()
    if (new URL(route.request().url()).searchParams.get('scale') === 'RACE-A') await oldGate
    await route.fulfill({ response })
  })
  const oldRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('scale') === 'RACE-A')
  await page.getByTestId('filter-scale-option-RACE-A').click()
  await oldRequest
  await page.getByTestId('filter-scale-option-RACE-B').click()
  await expect(page.getByTestId('list-row')).toHaveCount(2)
  const oldResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get('scale') === 'RACE-A')
  releaseOld()
  await (await oldResponse).finished()
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('list-row')).toHaveCount(2)
  await expect(page.getByTestId('list-row').filter({ hasText: 'RACE-B' })).toBeVisible()
})
