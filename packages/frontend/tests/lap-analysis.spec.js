import { test, expect } from '@playwright/test'
import Database from 'better-sqlite3'
import { E2E_DB } from './globalSetup.js'

// Served by the Playwright-managed backend, on its own throwaway database
const API_URL = 'http://localhost:3101'
const stamp = () => `E2E-${Date.now()}-${Math.floor(Math.random() * 1000)}`

async function api(request, method, endpoint, body) {
  const res = await request.fetch(`${API_URL}${endpoint}`, { method, data: body })
  expect(res.ok(), `${method} ${endpoint}: ${await res.text()}`).toBeTruthy()
  return (await res.json()).data
}

// Running a session needs a CU: the race is stored as run, with each controller's laps (ms)
function storeRace(sessionId, lapsByController) {
  const db = new Database(E2E_DB)
  try {
    db.pragma('busy_timeout = 5000')
    db.prepare("UPDATE Session SET status = 'finished' WHERE id = ?").run(sessionId)
    const lap = db.prepare(
      "INSERT INTO Lap (id, sessionId, trackId, carId, controller, phase, lapNumber, lapTime, timestamp) VALUES (?, ?, 'e2e-track', 'e2e-c1', ?, 'race', ?, ?, ?)"
    )
    const totals = db.prepare(
      'UPDATE SessionDriver SET totalLaps = ?, totalTime = ?, bestLapTime = ? WHERE sessionId = ? AND controller = ?'
    )
    for (const [controller, times] of lapsByController.entries()) {
      times.forEach((time, i) =>
        lap.run(`${sessionId}-${controller}-${i}`, sessionId, controller, i + 1, time, Date.now())
      )
      const total = times.reduce((sum, time) => sum + time, 0)
      totals.run(times.length, total, Math.min(...times), sessionId, controller)
    }
  } finally {
    db.close()
  }
}

/**
 * The lap analysis under the leaderboard of a race that ran, in the championship and on the session's
 * own page: the pace with its incidents, the gaps ending on each driver, the consistency figures.
 */
test('the lap analysis of a race: pace, gaps and consistency, in the championship and on the session page', async ({
  page,
  request,
}) => {
  const run = stamp()
  const [ana, ben] = await Promise.all(
    ['Ana', 'Ben'].map((name) => api(request, 'POST', '/api/drivers', { name: `${run} ${name}` }))
  )
  const championship = await api(request, 'POST', '/api/championships', {
    name: `Championnat ${run}`,
    season: '2026',
    trackId: 'e2e-track',
    mode: 'manual',
    raceMaxLaps: 5,
    participants: [ana, ben].map((d) => ({ driverId: d.id, carId: null })),
    sessions: [{ type: 'race', drivers: [ana, ben].map((d, controller) => ({ driverId: d.id, controller })) }],
  })
  const [race] = await api(request, 'GET', `/api/sessions?championshipId=${championship.id}`)
  // Ana wins with an incident on her third lap; Ben is clean, slower, a lap down
  storeRace(race.id, [
    [9000, 9200, 15050, 9100, 9000],
    [12000, 12100, 12200, 12000],
  ])

  await page.goto(`/championships/${championship.id}`)
  await page.getByRole('button', { name: 'R1', exact: true }).click()
  const analysis = page.getByTestId('lap-analysis')
  await expect(analysis.getByTestId('analysis-line')).toHaveCount(2)
  await expect(analysis.getByTestId('analysis-incident')).toHaveCount(1)
  await expect(analysis.getByTestId('analysis-fastest')).toHaveText('9.000')

  await page.goto(`/sessions/${race.id}`)
  await expect(analysis.getByTestId('analysis-line')).toHaveCount(2)
  // Pointing at the plot reads a lap, with the real time of each driver
  await analysis.getByTestId('analysis-plot').hover()
  await expect(analysis.getByTestId('analysis-tip')).toContainText('Tour 3')
  await expect(analysis.getByTestId('analysis-read')).toHaveText([/Ben12\.200$/, /Anaincident15\.050$/])

  await analysis.getByRole('radio', { name: 'Écarts' }).click()
  await expect(analysis.getByTestId('analysis-end')).toHaveText([/Ana$/, /Ben\+1 tour$/])

  await analysis.getByRole('radio', { name: 'Régularité' }).click()
  const [first, second] = [0, 1].map((i) => analysis.getByTestId('analysis-row').nth(i))
  // Her incident cost six seconds over her median lap (9.050)
  await expect(first.getByTestId('analysis-incidents')).toHaveText('1')
  await expect(first.getByTestId('analysis-lost')).toHaveText('6.0 s')
  await expect(second.getByTestId('analysis-incidents')).toHaveText('0')

  // The view picked is remembered
  await page.reload()
  await expect(analysis.getByRole('radio', { name: 'Régularité' })).toBeChecked()
})
