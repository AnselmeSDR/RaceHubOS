import { test, expect } from '@playwright/test'
const API = 'http://localhost:3101'
test.beforeEach(async ({ page, request }) => {
  await request.put(`${API}/api/preferences/cars:scaleFilter`, { data: { value: 'all' } })
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('catalogue-language-set')) {
      localStorage.setItem('racehubos-lang', 'en')
      sessionStorage.setItem('catalogue-language-set', '1')
    }
  })
})
test('lookup and selected adoption preserve existing settings and mounted tyres', async ({ page, request }) => {
  const car = (
    await (
      await request.post(`${API}/api/cars`, {
        data: {
          brand: 'Catalogue E2E',
          model: `Own-${Date.now()}`,
          maxSpeed: 30,
          brakeForce: 40,
          fuelCapacity: 80,
          tyresFront: 'My front tyres',
          tyresRear: 'My rear tyres',
          motor: 'My motor',
          notes: 'My notes',
          year: 2020,
        },
      })
    ).json()
  ).data
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`/cars/${car.id}`)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'Car product reference', exact: true }).fill('c4226')
  await page.getByRole('button', { name: 'Search local catalogue', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Product source', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Apply selected data and image', exact: true }).click()
  await page.screenshot({ path: '../../../car-catalog-form.png', fullPage: true })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeHidden()
  const saved = (await (await request.get(`${API}/api/cars/${car.id}`)).json()).data
  expect(saved.articleNumber).toBe('C4226')
  expect(saved.model).toContain('K.I.T.T.')
  for (const key of ['maxSpeed', 'brakeForce', 'fuelCapacity', 'tyresFront', 'tyresRear', 'motor', 'notes', 'year'])
    expect(saved[key]).toBe(car[key])
  expect(saved.img).toContain('/api/img/cars/')
  expect((await request.get(`${API}${saved.img}`)).ok()).toBeTruthy()
  await page.screenshot({ path: '../../../car-catalog-profile.png', fullPage: true })
  expect(errors).toEqual([])
})
test('offline search supports verified alias and cancellation creates no car', async ({ page, request }) => {
  const before = (await (await request.get(`${API}/api/cars?limit=100`)).json()).total
  await page.goto('/cars')
  await page.getByRole('button', { name: 'New car', exact: true }).click()
  await page.getByRole('textbox', { name: 'Car product reference', exact: true }).fill('C4249')
  await page.getByRole('button', { name: 'Search local catalogue', exact: true }).click()
  await expect(page.getByText('H4249 · SUPERSLOT · 1:32', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await (await request.get(`${API}/api/cars?limit=100`)).json()).total).toBe(before)
})
test('scale filter persists across reload and filters the vehicle list', async ({ page, request }) => {
  const model = `Scale-${Date.now()}`
  await request.post(`${API}/api/cars`, { data: { brand: 'ScaleE2E', model, scale: '1:24' } })
  await page.goto('/cars')
  const filter = page.getByRole('combobox', { name: 'Show cars by scale', exact: true })
  await filter.selectOption('124')
  await expect(page.getByText(model, { exact: true })).toBeVisible()
  await page.reload()
  await expect(filter).toHaveValue('124')
  await filter.selectOption('132')
  await expect(page.getByText(model, { exact: true })).toHaveCount(0)
})
test('catalogue settings and French/English labels render without runtime errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: 'Update catalogue', exact: true })).toBeVisible()
  await page.evaluate(() => localStorage.setItem('racehubos-lang', 'fr'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Mettre à jour le catalogue', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
