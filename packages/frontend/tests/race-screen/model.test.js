import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  defaultScreen,
  normalizeScreen,
  normalizeScreens,
  editScreen,
  startLights,
  shouldOpenScreen,
  screenGap,
} from '../../src/lib/raceScreen.js'
import { fuelTelemetry } from '../../src/lib/fuelTelemetry.js'

test('race screen and both opening options are off by default; old layouts are not migrated', () => {
  const value = normalizeScreens(null)
  assert.equal(value.enabled, false)
  assert.equal(value.autoOpen, false)
  assert.equal(value.fullscreen, false)
  assert.equal(value.profiles.length, 1)
  assert.deepEqual(normalizeScreens({ widgets: { name: { x: 77 } } }).profiles[0].layout, normalizeScreen(null))
  assert.equal(shouldOpenScreen(null, { id: 'one', status: 'active' }, value), false)
  assert.equal(
    shouldOpenScreen(null, { id: 'one', status: 'active' }, { ...value, enabled: false, autoOpen: true }),
    false
  )
})
test('activation opens once; resume and disabled/finished states never reopen', () => {
  const config = { enabled: true, autoOpen: true }
  const active = { id: 'one', status: 'active' }
  assert.equal(shouldOpenScreen(null, active, config), true)
  assert.equal(shouldOpenScreen(active, active, config), false)
  assert.equal(shouldOpenScreen({ ...active, status: 'paused' }, active, config), false)
  assert.equal(shouldOpenScreen(null, { ...active, status: 'finished' }, config), false)
})
test('layout bounds, row inheritance and geometry preserve independent defaults', () => {
  const value = normalizeScreen({ widgets: { name: { x: 300, w: 999, y: -4, font: 1000 } } })
  assert.equal(value.widgets.name.x, 98)
  assert.equal(value.widgets.name.w, 2)
  assert.equal(value.widgets.name.font, 100)
  value.widgets.name.x = 0
  assert.equal(defaultScreen.widgets.name.x, 13)
  const resized = editScreen(null, 'fuel', { h: 60 })
  assert.equal(resized.widgets.fuel.h, 60)
  assert.ok(resized.widgets.pit.h < defaultScreen.widgets.pit.h)
  for (const box of Object.values(editScreen(null, 'rows', { h: 200 }).widgets))
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= 100 && box.y + box.h <= 100.00001)
})
test('profile data is bounded, deduplicated and activates only an existing ID', () => {
  const value = normalizeScreens({
    enabled: true,
    activeProfile: 'missing',
    profiles: [
      { id: 'one', name: 'One', layout: null },
      { id: 'one', name: 'Duplicate', layout: null },
    ],
  })
  assert.equal(value.profiles.length, 1)
  assert.equal(value.activeProfile, 'one')
  assert.equal(value.enabled, true)
})
test('CU fifth lamp never invents a false start and disconnected data stays unknown', () => {
  assert.deepEqual(
    [2, 3, 4, 5, 6].map((start) => startLights(start, true).count),
    [1, 2, 3, 4, 5]
  )
  assert.equal(startLights(7, true).go, true)
  assert.equal(startLights(6, true).falseStart, false)
  assert.equal(startLights(0, true).visible, false)
  assert.equal(startLights(5, false).visible, false)
})
test('gap units and fuel freshness remain explicit', () => {
  assert.deepEqual(screenGap({ stats: { laps: 2, gap: 1 } }, { stats: { laps: 3 } }, 'race'), {
    type: 'laps',
    value: 1,
  })
  const input = {
    connected: true,
    socketConnected: true,
    receivedAt: 1000,
    now: 2000,
    status: { mode: 5, fuel: [3], pit: [false] },
  }
  assert.equal(fuelTelemetry(input).raw, 3)
  assert.equal(fuelTelemetry({ ...input, now: 7000 }).available, false)
})
test('DeviceContext, SessionContext, backend, versions and changelog remain untouched', () => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  for (const name of [
    'package.json',
    'CHANGELOG.md',
    'packages/backend/src/services/SyncService.js',
    'packages/backend/src/services/SessionService.js',
    'packages/frontend/src/context/DeviceContext.jsx',
    'packages/frontend/src/context/SessionContext.jsx',
  ])
    assert.deepEqual(
      fs.readFileSync(path.join(root, name)),
      execFileSync('git', ['show', '8ac83c2:' + name], { cwd: root })
    )
})
