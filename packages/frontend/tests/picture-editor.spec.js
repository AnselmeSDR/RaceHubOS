import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

// A red block on a black background, 160×100
const PICTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/pictures/car-on-black.png')

test('a picture is framed whole, its plain background removed, and uploaded as a square PNG', async ({ page }) => {
  // The upload is answered here: nothing is written on disk, and the form is never saved
  let body = null
  await page.route('**/api/upload/cars', async (route) => {
    body = route.request().postDataBuffer()
    await route.fulfill({ json: { success: true, data: { url: '/api/img/cars/framed.png' } } })
  })
  await page.goto('/cars')
  await page.getByTestId('page-add').click()
  const modal = page.getByTestId('modal')
  await modal.locator('input[type=file]').setInputFiles(PICTURE)

  const editor = page.getByTestId('picture-editor')
  await expect(editor.getByRole('button', { name: 'Valider' })).toBeEnabled()
  await editor.getByRole('button', { name: 'Retirer le fond' }).click()
  await expect(editor).toContainText("80 % de l'image retiré.")
  await editor.getByRole('button', { name: 'Valider' }).click()
  await expect(editor).toBeHidden()

  // Shown whole (zoom at « Ajuster »), the 160 px width spans the square: 160×160, never upscaled to 512
  await expect.poll(() => body).not.toBeNull()
  const png = body.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  expect(png).toBeGreaterThan(-1)
  expect([body.readUInt32BE(png + 16), body.readUInt32BE(png + 20)]).toEqual([160, 160])
  await expect(modal.locator('img[src="/api/img/cars/framed.png"]')).toBeVisible()
})
