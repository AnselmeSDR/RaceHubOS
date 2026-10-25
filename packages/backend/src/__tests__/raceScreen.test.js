import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import {
  normalizeScreen,
  normalizeScreens,
  defaultScreen,
  editScreen,
  shouldOpenScreen,
  screenTime,
  startLights,
} from '../../../frontend/src/lib/raceScreen.mjs';

test('named screen profiles preserve the legacy layout and select one complete active layout', () => {
  const old = normalizeScreen({ background: '#123456' });
  const migrated = normalizeScreens(old);
  assert.equal(migrated.profiles[0].layout.background, '#123456');
  const multiple = normalizeScreens({
    activeProfile: 'second',
    profiles: [...migrated.profiles, { id: 'second', name: 'TV groß', layout: { background: '#abcdef' } }],
  });
  assert.equal(multiple.profiles.find((p) => p.id === multiple.activeProfile).layout.background, '#abcdef');
  assert.equal(multiple.profiles[0].layout.background, '#123456');
  assert.equal(
    normalizeScreens({ profiles: multiple.profiles, activeProfile: 'missing' }).activeProfile,
    migrated.activeProfile
  );
  assert.equal(normalizeScreens(null).profiles.length, 2);
});

test('resizing a template column redistributes siblings, respects bounds and preserves independent fields', () => {
  const before = normalizeScreen(defaultScreen);
  const taller = editScreen(before, 'fuel', { h: 60 });
  assert.equal(taller.widgets.fuel.h, 60);
  assert.ok(taller.widgets.pit.y > before.widgets.pit.y);
  assert.ok(taller.widgets.pit.h < before.widgets.pit.h);
  assert.deepEqual(taller.widgets.name, before.widgets.name);
  assert.deepEqual(taller.widgets.lights, before.widgets.lights);
  const shorter = editScreen(taller, 'fuel', { h: 40 });
  assert.ok(shorter.widgets.pit.h > taller.widgets.pit.h);
  const last = editScreen(before, 'pit', { h: 60 });
  assert.ok(last.widgets.fuel.h < before.widgets.fuel.h);
  assert.equal(last.widgets.pit.h, 60);
  for (const b of Object.values(editScreen(before, 'rows', { h: 100 }).widgets)) {
    assert.ok(b.h >= 2 && b.y >= 0 && b.y + b.h <= 100.00001);
  }
  assert.deepEqual(editScreen({ ...before, autoHeight: false }, 'fuel', { h: 60 }).widgets.pit, before.widgets.pit);
});

test('layout data is bounded, complete and independent of defaults', () => {
  const config = normalizeScreen({ widgets: { name: { x: 300, y: -1, w: 200, h: NaN, font: 999, visible: false } } });
  assert.equal(config.widgets.name.x, 98);
  assert.equal(config.widgets.name.w, 2);
  assert.equal(config.widgets.name.font, 100);
  assert.equal(config.widgets.name.visible, false);
  assert.equal(normalizeScreen({ background: 'invalid' }).background, defaultScreen.background);
  assert.equal(normalizeScreen({ textColor: '#123456' }).textColor, '#123456');
  assert.equal(Object.keys(config.widgets).length, Object.keys(defaultScreen.widgets).length);
  config.widgets.name.x = 0;
  assert.equal(defaultScreen.widgets.name.x, 13);
  for (const b of Object.values(normalizeScreen(null).widgets)) {
    assert.ok(b.x + b.w <= 100 && b.y + b.h <= 100);
  }
});
test('CU countdown overlays the screen only until racing, without a false alarm at the fifth lamp', () => {
  assert.equal(startLights(1, true).count, 5);
  assert.equal(startLights(5, true).count, 4);
  assert.deepEqual(
    [2, 3, 4, 5, 6].map((s) => startLights(s, true).count),
    [1, 2, 3, 4, 5]
  );
  assert.equal(startLights(7, true).go, true);
  assert.equal(startLights(6, true).falseStart, false);
  for (const state of [0, 8, null, undefined]) assert.equal(startLights(state, true).visible, false);
  assert.equal(startLights(5, false).visible, false);
});
test('activation opens once, resume does not reopen after closing and opt-out works', () => {
  const active = { id: 'race-1', status: 'active' };
  assert.equal(shouldOpenScreen(null, active, defaultScreen), true);
  assert.equal(shouldOpenScreen({ ...active, status: 'draft' }, active, defaultScreen), true);
  assert.equal(shouldOpenScreen(active, active, defaultScreen), false);
  assert.equal(shouldOpenScreen({ ...active, status: 'paused' }, active, defaultScreen), false);
  assert.equal(shouldOpenScreen(null, active, { autoOpen: false }), false);
  assert.equal(shouldOpenScreen(null, { ...active, status: 'finished' }, defaultScreen), false);
  assert.equal(screenTime(8234), '8,234 s');
  assert.equal(screenTime(null), '—');
});
