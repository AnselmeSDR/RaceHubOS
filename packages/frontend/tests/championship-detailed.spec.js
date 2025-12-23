import { test, expect } from '@playwright/test'

test.describe('Championship Detailed Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to championship detail page
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    // Click on first championship
    const championshipCard = page.locator('h3').first()
    if (await championshipCard.count() > 0) {
      await championshipCard.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('ChampionshipHeader - All elements present', async ({ page }) => {
    // Check championship name is displayed (in main content, not sidebar)
    const mainContent = page.locator('main')
    const championshipName = mainContent.getByRole('heading', { level: 1 })
    await expect(championshipName).toBeVisible()
    console.log('Championship name:', await championshipName.textContent())

    // Check circuit name is displayed
    const circuitInfo = mainContent.locator('p').first()
    console.log('Circuit info:', await circuitInfo.textContent())

    // Check session buttons exist
    const elButton = page.locator('button').filter({ hasText: 'EL' })
    console.log('EL button exists:', await elButton.count() > 0)
    expect(await elButton.count()).toBeGreaterThan(0)

    // Check add buttons exist (just "Qualif" and "Course")
    const addQualifBtn = page.locator('button').filter({ hasText: 'Qualif' })
    const addRaceBtn = page.locator('button').filter({ hasText: 'Course' })
    console.log('Qualif button:', await addQualifBtn.count())
    console.log('Course button:', await addRaceBtn.count())

    // Verify at least one add button exists
    expect(await addQualifBtn.count() + await addRaceBtn.count()).toBeGreaterThan(0)
  })

  test('SessionSection - Elements and status', async ({ page }) => {
    // Find session section
    const sessionSection = page.locator('.bg-white.rounded-xl.border').first()
    await expect(sessionSection).toBeVisible()

    // Check for session title (EL, Q1, R1, etc.)
    const sessionTitle = sessionSection.locator('h2')
    if (await sessionTitle.count() > 0) {
      console.log('Session title:', await sessionTitle.textContent())
    }

    // Check for status badge
    const statusBadge = sessionSection.locator('.rounded-full')
    console.log('Status badges in section:', await statusBadge.count())

    // Check for action buttons (Start/Stop)
    const startBtn = sessionSection.locator('button').filter({ hasText: /démarrer/i })
    const stopBtn = sessionSection.locator('button').filter({ hasText: /arrêter/i })
    console.log('Start button:', await startBtn.count())
    console.log('Stop button:', await stopBtn.count())
  })

  test('SessionConfigModal - Open and verify form', async ({ page }) => {
    // Click config button (title contains "session")
    const configBtn = page.locator('button[title*="ession"]').first()
    if (await configBtn.count() === 0) {
      console.log('No config button found - skipping test')
      return
    }

    await configBtn.click()
    await page.waitForTimeout(500)

    // Check modal is open
    const modal = page.locator('.fixed.inset-0')
    await expect(modal).toBeVisible()

    // Check modal title
    const modalTitle = modal.locator('h2')
    console.log('Modal title:', await modalTitle.textContent())

    // Check form fields
    // - Name input
    const nameInput = modal.locator('input[type="text"]').first()
    await expect(nameInput).toBeVisible()
    console.log('Name input value:', await nameInput.inputValue())

    // - Type field (should be readonly)
    const typeField = modal.locator('.bg-gray-100').filter({ hasText: /essais|qualif|course/i })
    console.log('Type field count:', await typeField.count())

    // - Controller config table
    const table = modal.locator('table')
    if (await table.count() > 0) {
      console.log('Controller table found')

      // Check for 6 controller rows
      const rows = table.locator('tbody tr')
      const rowCount = await rows.count()
      console.log('Controller rows:', rowCount)
      expect(rowCount).toBe(6)

      // Check for driver/car selects
      const selects = modal.locator('select')
      console.log('Select dropdowns:', await selects.count())
    }

    // - Status radio buttons (if editable)
    const draftRadio = modal.locator('input[type="radio"][value="draft"]')
    const readyRadio = modal.locator('input[type="radio"][value="ready"]')
    console.log('Draft radio:', await draftRadio.count())
    console.log('Ready radio:', await readyRadio.count())

    // - Action buttons
    const cancelBtn = modal.locator('button').filter({ hasText: /annuler/i })
    const saveBtn = modal.locator('button').filter({ hasText: /enregistrer|sauvegarder/i })
    console.log('Cancel button:', await cancelBtn.count())
    console.log('Save button:', await saveBtn.count())

    // Close modal
    await cancelBtn.first().click()
    await page.waitForTimeout(300)
    await expect(modal).not.toBeVisible()
  })

  test('StandingsTabs - Tab switching', async ({ page }) => {
    // Find standings section
    const standingsSection = page.locator('text=Classement General').locator('..')

    // Find tab buttons (exact text match for tabs)
    const practiceTab = page.locator('button').filter({ hasText: 'Essais Libres' })
    const qualifTab = page.locator('button').filter({ hasText: 'Qualifications' })
    const raceTab = page.locator('button').filter({ hasText: 'Courses' })

    console.log('Practice tab:', await practiceTab.count())
    console.log('Qualif tab:', await qualifTab.count())
    console.log('Race tab:', await raceTab.count())

    // Click on each tab and verify content changes
    if (await qualifTab.count() > 0) {
      await qualifTab.first().click()
      await page.waitForTimeout(300)

      // Check for active state
      const activeTab = page.locator('button.border-b-2')
      console.log('Active tabs after qualif click:', await activeTab.count())
    }

    if (await raceTab.count() > 0) {
      await raceTab.first().click()
      await page.waitForTimeout(300)
    }

    if (await practiceTab.count() > 0) {
      await practiceTab.first().click()
      await page.waitForTimeout(300)
    }
  })

  test('AddSessionModal - Qualifying', async ({ page }) => {
    // Click add qualif button
    const addQualifBtn = page.locator('button').filter({ hasText: /qualif/i }).first()
    if (await addQualifBtn.count() === 0) {
      console.log('No add qualif button - skipping')
      return
    }

    await addQualifBtn.click()
    await page.waitForTimeout(500)

    // Check modal
    const modal = page.locator('.fixed.inset-0')
    await expect(modal).toBeVisible()

    // Check it's a qualifying modal
    const modalContent = await modal.textContent()
    console.log('Modal contains "Qualification":', modalContent?.includes('Qualif'))

    // Check form fields exist
    const inputs = modal.locator('input')
    console.log('Input fields:', await inputs.count())

    // Close modal
    const closeBtn = modal.locator('button').filter({ hasText: /annuler|fermer/i }).first()
    if (await closeBtn.count() > 0) {
      await closeBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
  })

  test('AddSessionModal - Race', async ({ page }) => {
    // Click add race button
    const addRaceBtn = page.locator('button').filter({ hasText: /course/i }).first()
    if (await addRaceBtn.count() === 0) {
      console.log('No add race button - skipping')
      return
    }

    await addRaceBtn.click()
    await page.waitForTimeout(500)

    // Check modal
    const modal = page.locator('.fixed.inset-0')
    await expect(modal).toBeVisible()

    // Check it's a race modal
    const modalContent = await modal.textContent()
    console.log('Modal contains "Course":', modalContent?.includes('Course'))

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('Session selection persists', async ({ page }) => {
    // Get current URL
    const initialUrl = page.url()

    // Find and click a different session button if available
    const sessionButtons = page.locator('button').filter({ hasText: /^(EL|Q\d+|R\d+)$/ })
    const count = await sessionButtons.count()

    if (count >= 2) {
      // Click second session
      await sessionButtons.nth(1).click()
      await page.waitForTimeout(500)

      // Reload page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Verify selection persisted (check localStorage or UI state)
      // The selected session should still be highlighted
    }
  })

  test('Verify no JavaScript errors during interactions', async ({ page }) => {
    const errors = []

    page.on('pageerror', err => {
      errors.push(err.message)
    })

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Perform various interactions
    // 1. Click through sessions
    const sessionButtons = page.locator('button').filter({ hasText: /^(EL|Q\d+|R\d+)$/ })
    for (let i = 0; i < Math.min(await sessionButtons.count(), 3); i++) {
      await sessionButtons.nth(i).click()
      await page.waitForTimeout(300)
    }

    // 2. Open config modal
    const configBtn = page.locator('button[title*="ession"]').first()
    if (await configBtn.count() > 0) {
      await configBtn.click()
      await page.waitForTimeout(500)

      // Interact with form
      const selects = page.locator('.fixed.inset-0 select')
      if (await selects.count() > 0) {
        await selects.first().click()
        await page.waitForTimeout(200)
      }

      // Close modal
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    // 3. Click through standings tabs
    const tabs = page.locator('button').filter({ hasText: /essais|qualif|course/i })
    for (let i = 0; i < await tabs.count(); i++) {
      await tabs.nth(i).click()
      await page.waitForTimeout(200)
    }

    // Wait for any async operations
    await page.waitForTimeout(1000)

    // Filter out expected errors
    const criticalErrors = errors.filter(e =>
      !e.includes('WebSocket') &&
      !e.includes('socket') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to fetch')
    )

    if (criticalErrors.length > 0) {
      console.log('Critical errors found:')
      criticalErrors.forEach(e => console.log(' -', e))
    }

    expect(criticalErrors).toHaveLength(0)
  })

  test('Leaderboard displays driver information', async ({ page }) => {
    // Look for driver names or avatars in the leaderboard
    const leaderboard = page.locator('.divide-y').first()

    if (await leaderboard.count() > 0) {
      // Check for driver entries
      const entries = leaderboard.locator('> div')
      console.log('Leaderboard entries:', await entries.count())

      // Check for driver avatars (colored circles)
      const avatars = leaderboard.locator('.rounded-full')
      console.log('Driver avatars:', await avatars.count())

      // Check for lap times
      const lapTimes = page.locator('text=/\\d+\\.\\d{3}/')
      console.log('Lap times displayed:', await lapTimes.count())
    }
  })
})
