import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePitAdvice, planPitAdvice } from '../../src/lib/pitAdvice.js'
const entries = [0, 1, 2].map((controller) => ({ controller, driver: { name: 'Driver ' + controller } }))
const device = {
  connected: true,
  socketConnected: true,
  lastStatusAt: 1000,
  cuStatus: { mode: 5, fuel: [5, 0, 3], pit: [false, false, false] },
}
test('disabled by default and no planning without explicit activation', () => {
  assert.deepEqual(normalizePitAdvice(null), { enabled: false, places: 1 })
  assert.equal(planPitAdvice(entries, device, null, 2000), null)
})
test('lowest fuel and zero-fuel urgency, bounded one/two-place groups', () => {
  const plan = planPitAdvice(entries, device, { enabled: true, places: 2 }, 2000)
  assert.equal(plan.status, 'recommended')
  assert.deepEqual(
    plan.group.map((item) => item.controller),
    [1, 2]
  )
  assert.equal(plan.group[0].urgent, true)
  assert.equal(plan.remaining, 1)
  assert.equal(planPitAdvice(entries, device, { enabled: true, places: 1 }, 2000).group.length, 1)
})
test('stale, disconnected, invalid, fuel-off or missing-pit telemetry never produces advice', () => {
  for (const source of [
    { ...device, lastStatusAt: 0 },
    { ...device, connected: false },
    { ...device, socketConnected: false },
    { ...device, cuStatus: { ...device.cuStatus, fuel: [5, 99, 3] } },
    { ...device, cuStatus: { ...device.cuStatus, mode: 4 } },
    { ...device, cuStatus: { ...device.cuStatus, mode: 1 } },
  ])
    assert.equal(
      planPitAdvice(entries, source, { enabled: true }, source.lastStatusAt === 0 ? 7000 : 2000).status,
      'unavailable'
    )
})
test('cars already in pit are excluded; lane count does not assign left/right occupancy', () => {
  const plan = planPitAdvice(
    entries,
    { ...device, cuStatus: { ...device.cuStatus, pit: [false, true, false] } },
    { enabled: true, places: 2 },
    2000
  )
  assert.equal(plan.inside, 1)
  assert.deepEqual(
    plan.group.map((item) => item.controller),
    [2, 0]
  )
  assert.equal(Object.hasOwn(plan, 'left'), false)
  assert.equal(Object.hasOwn(plan, 'right'), false)
})
test('missing/duplicate controllers stay unknown and high fuel yields no stop', () => {
  assert.equal(planPitAdvice([entries[0], entries[0]], device, { enabled: true }, 2000).status, 'unavailable')
  assert.equal(planPitAdvice([], device, { enabled: true }, 2000).status, 'unavailable')
  assert.equal(
    planPitAdvice(entries, { ...device, cuStatus: { ...device.cuStatus, fuel: [15, 14, 6] } }, { enabled: true }, 2000)
      .status,
    'none'
  )
})
