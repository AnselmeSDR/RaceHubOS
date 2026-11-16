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

// Running a session needs a CU: the session is marked as run straight in the database
function markFinished(sessionId) {
  const db = new Database(E2E_DB)
  try {
    db.pragma('busy_timeout = 5000')
    db.prepare("UPDATE Session SET status = 'finished' WHERE id = ?").run(sessionId)
  } finally {
    db.close()
  }
}

/**
 * A championship under way edited through the wizard and saved for real: a driver who raced and
 * leaves is DNF in the session to come they were in, one who never raced is simply gone, and the
 * session that ran keeps its grid.
 */
test('editing a championship under way: a driver who raced leaves, DNF in the session to come', async ({
  page,
  request,
}) => {
  const run = stamp()
  const [ana, ben, cid, dan] = await Promise.all(
    ['Ana', 'Ben', 'Cid', 'Dan'].map((name) => api(request, 'POST', '/api/drivers', { name: `${name} ${run}` }))
  )
  const entries = (...drivers) => drivers.map((d, controller) => ({ driverId: d.id, controller }))
  const championship = await api(request, 'POST', '/api/championships', {
    name: `Championnat ${run}`,
    season: '2026',
    trackId: 'e2e-track',
    mode: 'manual',
    qualifMaxDuration: 300000,
    participants: [ana, ben, cid, dan].map((d) => ({ driverId: d.id, carId: null })),
    sessions: [
      { type: 'practice', drivers: entries(ana, ben) },
      { type: 'qualif', drivers: entries(ana, ben, cid, dan) },
    ],
  })
  const sessionsOf = async () =>
    (await api(request, 'GET', `/api/sessions?championshipId=${championship.id}`)).toSorted((a, b) => a.order - b.order)
  const [practice, qualif] = await sessionsOf()
  markFinished(practice.id)

  await page.goto(`/championships/${championship.id}`)
  await page.getByTitle('Configuration').click()
  const modal = page.getByTestId('modal')
  const steps = modal.getByTestId('championship-wizard-steps').getByRole('button')

  // Ben raced the practice: removed, he stays listed, retired; Cid never raced: gone
  await steps.nth(1).click()
  const rows = modal.getByTestId('wizard-participant')
  await rows.nth(1).getByRole('button', { name: 'Supprimer' }).click()
  await rows.nth(1).getByRole('button', { name: 'Supprimer' }).click()
  await expect(modal.getByTestId('wizard-retired')).toHaveCount(1)
  await expect(modal.getByTestId('wizard-retired')).toContainText(`Ben ${run}`)

  // The practice is shown as it ran, Ben DNF in the qualif to come
  await steps.nth(2).click()
  await expect(modal.getByTestId('championship-wizard-frozen')).toHaveCount(1)
  await expect(modal.getByTestId('wizard-withdrawn')).toHaveCount(1)
  await expect(modal.getByTestId('wizard-withdrawn')).toContainText(`Ben ${run}`)

  await modal.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(modal).toBeHidden()

  const [ran, toCome] = await sessionsOf()
  expect(ran.id).toBe(practice.id)
  expect(ran.drivers.map((d) => d.driverId).toSorted()).toEqual([ana.id, ben.id].toSorted())
  expect(toCome.id).toBe(qualif.id)
  expect(toCome.drivers.map((d) => d.driverId).toSorted()).toEqual([ana.id, dan.id].toSorted())
  expect(toCome.withdrawals.map((w) => w.driverId)).toEqual([ben.id])

  await page.getByRole('button', { name: 'Q1', exact: true }).click()
  await expect(page.getByTestId('session-withdrawn')).toContainText(`Ben ${run}`)
})
