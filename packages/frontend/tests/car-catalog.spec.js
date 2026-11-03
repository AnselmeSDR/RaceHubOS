import { test, expect } from '@playwright/test'

const API = 'http://localhost:3101'
test.beforeEach(async ({ page }, testInfo) => {
  const language = testInfo.title.match(/form in (fr|de|en)$/)?.[1] || 'en'
  await page.addInitScript((value) => localStorage.setItem('racehubos-lang', value), language)
})

test('manual catalog entry, local photo, selective adoption and persistence', async ({ page, request }) => {
  const serial = `OWN-${Date.now()}`
  const photo = await request.post(`${API}/api/upload/cars`, {
    multipart: {
      img: {
        name: 'own.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64'
        ),
      },
    },
  })
  const img = (await photo.json()).data.url
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/catalog')
  await page.getByTestId('catalog-add').click()
  await page.getByTestId('catalog-field-serial').fill(serial)
  await page.getByTestId('catalog-field-brand').fill('My catalog brand')
  await page.getByTestId('catalog-field-model').fill('My catalog car')
  await page.getByTestId('catalog-field-year').fill('1888')
  await page.getByTestId('catalog-field-tyresRear').fill('Local rear tyres')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTestId('catalog-entry').filter({ hasText: serial })).toBeVisible()
  const entry = (await (await request.get(`${API}/api/catalog/lookup/${serial}`)).json()).data
  const { createdAt, updatedAt, ...data } = entry
  expect(createdAt).toBeTruthy()
  expect(updatedAt).toBeTruthy()
  await request.put(`${API}/api/catalog/${serial}`, { data: { ...data, img } })
  await page.reload()
  await expect(page.getByTestId('catalog-entry').filter({ hasText: serial }).locator('img')).toBeVisible()
  const car = (
    await (
      await request.post(`${API}/api/cars`, {
        data: {
          brand: 'Own brand',
          model: 'Own car',
          year: 2020,
          maxSpeed: 30,
          motor: 'My motor',
          tyresFront: 'My tyres',
        },
      })
    ).json()
  ).data
  await page.goto(`/cars/${car.id}`)
  await page.getByTestId('car-edit').click()
  await page.getByTestId('car-serial').fill(serial)
  await page.getByTestId('catalog-search').click()
  await expect(page.getByTestId('catalog-result')).toBeVisible()
  for (const key of ['model', 'year', 'img', 'tyresRear']) await page.getByTestId(`catalog-apply-${key}`).check()
  await page.getByTestId('catalog-apply').click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTestId('catalog-lookup')).toBeHidden()
  const saved = (await (await request.get(`${API}/api/cars/${car.id}`)).json()).data
  expect(saved.serial).toBe(serial)
  expect(saved.model).toBe('My catalog car')
  expect(saved.year).toBe(1888)
  expect(saved.img).toBe(img)
  expect(saved.tyresRear).toBe('Local rear tyres')
  expect(saved.brand).toBe('Own brand')
  expect(saved.maxSpeed).toBe(30)
  expect(saved.motor).toBe('My motor')
  expect(saved.tyresFront).toBe('My tyres')
  expect((await request.get(`${API}${img}`)).ok()).toBeTruthy()
  await page.reload()
  await expect(page.getByText(serial, { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})

test('JSON import, validation failure, editing and deletion', async ({ page, request }) => {
  const serial = `IMPORT-${Date.now()}`
  await page.goto('/catalog')
  const upload = async (entries) =>
    page.getByTestId('catalog-import').setInputFiles({
      name: 'catalog.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: 1, entries })),
    })
  await upload([{ serial, brand: 'Manual', model: 'Imported' }])
  await expect(page.getByRole('status')).toHaveText('Import completed.')
  const card = page.getByTestId('catalog-entry').filter({ hasText: serial })
  await expect(card).toBeVisible()
  await card.getByTestId('catalog-edit').click()
  await page.getByTestId('catalog-field-model').fill('Edited')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(card).toContainText('Edited')
  await upload([{ serial, brand: 'Manual', model: 'Rejected', img: 'https://shop.example/photo.jpg' }])
  await expect(page.getByRole('status')).toContainText('Import rejected.')
  expect((await (await request.get(`${API}/api/catalog/lookup/${serial}`)).json()).data.model).toBe('Edited')
  await card.getByTestId('catalog-delete').click()
  await expect(card).toBeHidden()
})

for (const [lang, title] of [
  ['fr', 'Catalogue'],
  ['de', 'Katalog'],
  ['en', 'Catalog'],
]) {
  test(`catalog navigation and form in ${lang}`, async ({ page }) => {
    await page.goto('/catalog')
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.getByTestId('catalog-add').click()
    await expect(page.getByTestId('catalog-field-serial')).toBeVisible()
  })
}
