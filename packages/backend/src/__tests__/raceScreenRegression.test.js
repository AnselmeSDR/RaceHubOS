import { test, expect } from '@jest/globals';
import { normalizeScreens, normalizeScreen, screenTime } from '../../../frontend/src/lib/raceScreen.mjs';
import { pitPlan } from '../../../frontend/src/lib/pitPlan.mjs';

test('a fresh installation offers the sector and pit template without private saved preferences', () => {
  const profiles = normalizeScreens(null).profiles;
  const preset = profiles.find((p) => p.id === 'sectors-and-pit');
  expect(preset).toBeDefined();
  expect(preset.layout.widgets.sectors.visible).toBe(true);
  expect(preset.layout.widgets.pitPlan.visible).toBe(true);
  expect(preset.layout.widgets.best.y + preset.layout.widgets.best.h).toBeLessThanOrEqual(
    preset.layout.widgets.sectors.y
  );
});
test('legacy saved screens remain unchanged and are not silently replaced by the new preset', () => {
  const legacy = normalizeScreen({ background: '#123456', widgets: { name: { x: 21 } } });
  const result = normalizeScreens(legacy);
  expect(result.profiles).toHaveLength(1);
  expect(result.profiles[0].layout).toEqual(legacy);
});
test('future and stale fuel samples never become valid by moving the current clock forward', () => {
  const entries = [{ controller: 0, driver: { name: 'Fixture driver' } }];
  const device = {
    connected: true,
    socketConnected: true,
    lastStatusAt: 20000,
    cuStatus: { mode: 5, fuel: [0], pit: [false] },
  };
  expect(pitPlan(entries, device, {}, 10000)).toMatch(/aktuelle Tankdaten/);
  expect(pitPlan(entries, { ...device, lastStatusAt: 1 }, {}, 10000)).toMatch(/aktuelle Tankdaten/);
});
test('pit-place settings outside the supported one/two range never invent additional parallel places', () => {
  const entries = [
    { controller: 0, driver: { name: 'One' } },
    { controller: 1, driver: { name: 'Two' } },
    { controller: 2, driver: { name: 'Three' } },
  ];
  const device = {
    connected: true,
    socketConnected: true,
    lastStatusAt: 10000,
    cuStatus: { mode: 5, fuel: [0, 1, 2], pit: [false, false, false] },
  };
  expect(pitPlan(entries, device, { pitPlaces: 99 }, 10000)).toMatch(/^2 Tankplätze/);
});
test('time formatting follows the selected display language and missing values stay unknown', () => {
  expect(screenTime(8234, 'en')).toBe('8.234 s');
  expect(screenTime(8234, 'de')).toBe('8,234 s');
  expect(screenTime(null, 'en')).toBe('—');
});
test('stored sector/pit preference values remain bounded without changing unrelated preferences', async () => {
  const { normalizeTrackExtras } = await import('../../../frontend/src/lib/pitPlan.mjs');
  expect(normalizeTrackExtras({ pitPlaces: 99, leftRoute: { bad: true }, rightRoute: 'x'.repeat(100) })).toEqual({
    sectors: true,
    pitPlan: true,
    pitPlaces: 2,
    leftRoute: '1× Weichentaste',
    rightRoute: 'x'.repeat(80),
  });
});
test('a numeric race lap deficit is never displayed as milliseconds', async () => {
  const { screenGap } = await import('../../../frontend/src/lib/raceScreen.mjs');
  expect(screenGap({ stats: { laps: 4, gap: 1 } }, { stats: { laps: 5 } }, 'race')).toEqual({ type: 'laps', value: 1 });
  expect(screenGap({ stats: { laps: 5, gap: 850 } }, { stats: { laps: 5 } }, 'race')).toEqual({
    type: 'time',
    value: 850,
  });
  expect(screenGap({ stats: { laps: 4, gap: 850 } }, { stats: { laps: 5 } }, 'qualif')).toEqual({
    type: 'time',
    value: 850,
  });
});
