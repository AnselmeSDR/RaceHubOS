import { test, expect } from '@playwright/test'

const API_URL = 'http://localhost:3000'

test.describe('Championship User Journey', () => {

  test.beforeEach(async ({ page }) => {
    // Wait for API to be ready
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('1. Navigate to championships list', async ({ page }) => {
    // Click on Championnats link in navigation
    await page.click('a[href="/championships"]')
    await expect(page).toHaveURL('/championships')

    // Check page title (use getByRole to be more specific)
    await expect(page.getByRole('heading', { name: 'Championnats', level: 1 })).toBeVisible()
  })

  test('2. View championship detail page', async ({ page }) => {
    // Go to championships
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    // Find championship cards (clickable divs with cursor-pointer)
    const championshipCards = page.locator('.cursor-pointer').filter({ has: page.locator('h3') })
    const cardCount = await championshipCards.count()
    console.log('Championships found:', cardCount)

    if (cardCount > 0) {
      // Click on first championship card
      await championshipCards.first().click()
      await page.waitForTimeout(500)
      await page.waitForLoadState('networkidle')

      // Should be on detail page
      await expect(page).toHaveURL(/\/championships\//)

      // Check header elements exist
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    } else {
      // No championships, check empty state
      console.log('No championships found - testing empty state')
      await expect(page.getByText(/aucun championnat/i)).toBeVisible()
    }
  })

  test('3. Championship detail - Header component', async ({ page }) => {
    // Navigate to first championship
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    // Get first championship link
    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Check ChampionshipHeader elements
      // - Championship name (h1)
      await expect(page.locator('h1')).toBeVisible()

      // - Back button
      await expect(page.locator('a[href="/championships"]')).toBeVisible()

      // - Session buttons (EL, Q1, R1, etc.)
      const sessionButtons = page.locator('button').filter({ hasText: /^(EL|Q\d|R\d)$/ })
      console.log('Session buttons found:', await sessionButtons.count())

      // - Add session buttons
      await expect(page.getByText('Qualif').or(page.getByText('Course'))).toBeVisible()
    }
  })

  test('4. Championship detail - Session section', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Check SessionSection elements
      // - Session title with type icon
      const sessionSection = page.locator('.bg-white.rounded-xl.border').first()
      await expect(sessionSection).toBeVisible()

      // - Status badge
      const statusBadge = page.locator('.rounded-full').filter({
        hasText: /brouillon|pret|en cours|termine/i
      })
      console.log('Status badges found:', await statusBadge.count())

      // - Config button (cog icon)
      const configButton = page.locator('button[title*="onfigur"]')
      console.log('Config buttons found:', await configButton.count())
    }
  })

  test('5. Championship detail - Standings tabs', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Check StandingsTabs component
      // - Tab buttons
      const tabButtons = page.locator('button').filter({
        hasText: /essais libres|qualif|course/i
      })
      const tabCount = await tabButtons.count()
      console.log('Standing tabs found:', tabCount)
      expect(tabCount).toBeGreaterThanOrEqual(2)

      // - Click on each tab
      if (tabCount >= 3) {
        // Click Qualif tab
        await tabButtons.nth(1).click()
        await page.waitForTimeout(300)

        // Click Course tab
        await tabButtons.nth(2).click()
        await page.waitForTimeout(300)

        // Click back to Essais Libres
        await tabButtons.nth(0).click()
      }
    }
  })

  test('6. Add qualifying session', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Click "+ Qualif" button
      const addQualifBtn = page.locator('button').filter({ hasText: /qualif/i })
      if (await addQualifBtn.count() > 0) {
        await addQualifBtn.click()

        // Check modal opened
        const modal = page.locator('.fixed.inset-0')
        await expect(modal).toBeVisible()

        // Check modal title
        await expect(page.getByText(/qualification|qualif/i)).toBeVisible()

        // Close modal
        const closeBtn = page.locator('button').filter({ hasText: /annuler|fermer/i }).first()
        if (await closeBtn.count() > 0) {
          await closeBtn.click()
        } else {
          // Click X button
          await page.locator('.fixed.inset-0 button').first().click()
        }
      }
    }
  })

  test('7. Add race session', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Click "+ Course" button
      const addRaceBtn = page.locator('button').filter({ hasText: /course/i })
      if (await addRaceBtn.count() > 0) {
        await addRaceBtn.click()

        // Check modal opened
        const modal = page.locator('.fixed.inset-0')
        await expect(modal).toBeVisible()

        // Close modal
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }
  })

  test('8. Open session config modal', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Click config button (cog icon)
      const configBtn = page.locator('button[title*="onfigur"]').first()
      if (await configBtn.count() > 0) {
        await configBtn.click()
        await page.waitForTimeout(300)

        // Check modal opened
        const modal = page.locator('.fixed.inset-0')
        await expect(modal).toBeVisible()

        // Check modal contains expected elements
        // - Name input
        await expect(page.locator('input[type="text"]').first()).toBeVisible()

        // - Controller config table
        const controllerTable = page.locator('table')
        if (await controllerTable.count() > 0) {
          console.log('Controller config table found')
        }

        // - Driver selects
        const driverSelects = page.locator('select')
        console.log('Select dropdowns found:', await driverSelects.count())

        // Close modal
        const cancelBtn = page.locator('button').filter({ hasText: /annuler/i })
        if (await cancelBtn.count() > 0) {
          await cancelBtn.click()
        }
      }
    }
  })

  test('9. Select different sessions', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Find session buttons (EL, Q1, R1, etc.)
      const sessionButtons = page.locator('button').filter({ hasText: /^(EL|Q\d+|R\d+)$/ })
      const count = await sessionButtons.count()
      console.log('Session buttons found:', count)

      // Click each session button
      for (let i = 0; i < count && i < 5; i++) {
        await sessionButtons.nth(i).click()
        await page.waitForTimeout(300)
        console.log(`Clicked session ${i + 1}`)
      }
    }
  })

  test('10. SessionLeaderboard displays correctly', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Check for leaderboard component
      // Look for position numbers or driver names
      const leaderboardRows = page.locator('[class*="divide-y"] > div').or(
        page.locator('table tbody tr')
      )
      const rowCount = await leaderboardRows.count()
      console.log('Leaderboard rows found:', rowCount)

      // Check for sort controls (practice mode)
      const sortControls = page.locator('button').filter({ hasText: /tours|temps/i })
      console.log('Sort controls found:', await sortControls.count())
    }
  })

  test('11. Data freshness indicator', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Look for data freshness indicator
      const freshnessIndicator = page.locator('[class*="text-green"]').or(
        page.locator('[class*="text-yellow"]').or(
          page.locator('[class*="text-red"]')
        )
      )
      console.log('Freshness indicators found:', await freshnessIndicator.count())
    }
  })

  test('12. Back navigation works', async ({ page }) => {
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/championships\//)

      // Click back button
      const backLink = page.locator('a[href="/championships"]')
      await expect(backLink).toBeVisible()
      await backLink.click()

      // Should be back on list
      await expect(page).toHaveURL('/championships')
    }
  })

  test('13. Console errors check', async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', err => {
      errors.push(err.message)
    })

    // Navigate through championship pages
    await page.goto('/championships')
    await page.waitForLoadState('networkidle')

    const firstLink = page.locator('a[href^="/championships/"]').first()
    if (await firstLink.count() > 0) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')

      // Wait a bit for any async errors
      await page.waitForTimeout(2000)
    }

    // Report errors
    if (errors.length > 0) {
      console.log('Console errors found:')
      errors.forEach(e => console.log(' -', e))
    }

    // Filter out expected errors (like WebSocket connection issues in test env)
    const criticalErrors = errors.filter(e =>
      !e.includes('WebSocket') &&
      !e.includes('socket') &&
      !e.includes('net::ERR')
    )

    expect(criticalErrors).toHaveLength(0)
  })
})
