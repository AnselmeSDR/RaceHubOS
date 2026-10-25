import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, locale: 'de-DE' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('racehubos-lang', 'de')
    localStorage.setItem('racehubos-sidebar', 'false')
  })
})

async function expectWithin(container, children) {
  const bounds = await container.boundingBox()
  for (const child of await children.all()) {
    const box = await child.boundingBox()
    expect(box).not.toBeNull()
    expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
  }
}

test('balancing uses its translated name and keeps toolbar controls in view', async ({ page }) => {
  await page.goto('/balancing')
  await expect(page.getByTestId('session-title')).toHaveText('Fahrzeugabgleich')
  const toolbar = page.getByTestId('balancing-toolbar')
  await expectWithin(toolbar, toolbar.getByRole('button'))
})

test('German championship title and all wizard steps remain readable', async ({ page }) => {
  await page.goto('/championships')
  const heading = page.getByTestId('page-header').getByRole('heading')
  await expect(heading).toHaveText('Meisterschaften')
  expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.getByTestId('page-add').click()
  const steps = page.getByTestId('championship-wizard-steps')
  await expect(steps.getByRole('button')).toHaveCount(4)
  await expectWithin(steps, steps.getByRole('button'))
  const modal = page.getByTestId('modal')
  await modal.getByRole('textbox').first().fill('Deutsche Testmeisterschaft')
  await modal.getByRole('combobox').selectOption('e2e-track')
  await modal.getByRole('button', { name: 'Weiter', exact: true }).click()
  await modal.getByRole('combobox').first().selectOption('e2e-d1')
  await modal.getByRole('combobox').nth(1).selectOption('e2e-d2')
  await modal.getByRole('button', { name: 'Weiter', exact: true }).click()
  const config = page.getByTestId('championship-wizard-config')
  await expect(config).toBeVisible()
  await expectWithin(config, config.getByRole('spinbutton'))
})

test('all German display categories remain inside a narrow screen', async ({ page }) => {
  await page.goto('/displays')
  const tabs = page.getByTestId('display-tabs')
  await expect(tabs.getByRole('button')).toHaveCount(6)
  await expectWithin(tabs, tabs.getByRole('button'))
  await tabs.getByRole('button', { name: 'Konfiguration', exact: true }).click()
  const panel = page.getByTestId('controller-config-panel')
  await expect(panel.getByRole('heading')).toHaveText('Fahrerzuordnung')
  await expectWithin(panel, panel.getByRole('combobox'))
})

test('free-session types and actions remain inside a narrow screen', async ({ page }) => {
  await page.goto('/race')
  const toolbar = page.getByTestId('free-session-toolbar')
  await expect(toolbar.getByRole('tab')).toHaveCount(3)
  await expectWithin(toolbar, toolbar.getByRole('tab'))
  await expectWithin(toolbar, toolbar.getByRole('button'))
})

test('long German names and dark demo headings remain readable', async ({ page, request }) => {
  const name = `Testteam Langstreckenmeisterschaft-${Date.now()}`
  const team = (await (await request.post('http://localhost:3101/api/teams', { data: { name } })).json()).data
  await request.put('http://localhost:3101/api/drivers/e2e-d1', { data: { teamId: team.id } })
  await page.goto('/teams')
  const heading = page.getByTestId('entity-card').filter({ hasText: name }).getByRole('heading')
  await expect(heading).toHaveText(name)
  expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.goto('/displays')
  const card = page.getByTestId('driver-select-card').filter({ hasText: name }).first()
  await expect(card).toBeVisible()
  expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.goto('/drivers/e2e-d1')
  const header = page.getByTestId('driver-profile-header')
  await expect(header).toContainText(name)
  const badge = page.getByTestId('driver-team-badge')
  await expect(badge).toHaveText(name)
  expect(await badge.evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(
    true
  )

  expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.evaluate(() => localStorage.setItem('racehubos-theme', 'dark'))
  await page.goto('/demo-displays')
  await expect(page.getByTestId('driver-display-demo').getByRole('heading').first()).toHaveCSS(
    'color',
    'rgb(255, 255, 255)'
  )
  const profile = page.getByTestId('driver-profile-display')
  await expectWithin(profile, profile.getByRole('heading'))
  await page.goto('/championships/e2e-champ')
  const grid = page.getByTestId('starting-grid')
  await expect(grid.getByTestId('driver-grid-position')).toHaveCount(2)
  for (const entry of await grid.getByTestId('driver-grid-position').all()) {
    expect(await entry.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
})

test('German championship configuration actions fit inside their sheet', async ({ page }) => {
  await page.goto('/championships/e2e-champ')
  await page.getByRole('button', { name: 'Konfiguration', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Meisterschaft konfigurieren', exact: true })
  await expect(dialog).toBeVisible()
  await expectWithin(dialog, dialog.getByRole('button'))
})

test('championship awards use translated titles instead of server French labels', async ({ page }) => {
  const ids = ['best-lap', 'best-qualif', 'best-race-lap', 'comeback', 'consistent', 'iron-man']
  await page.route('**/api/championships/e2e-champ/results', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { awards: ids.map((id) => ({ id, title: 'Server label in French', driver: { name: 'Testfahrer' } })) },
      },
    })
  )
  await page.goto('/championships/e2e-champ')
  await page.getByRole('button', { name: 'Ergebnisse', exact: true }).click()
  await expect(page.getByTestId('championship-award-title')).toHaveText([
    'Beste Runde',
    'Beste Qualifikation',
    'Schnellste Rennrunde',
    'Größte Aufholjagd',
    'Konstantester Fahrer',
    'Ausdauerndster Fahrer',
  ])
})
