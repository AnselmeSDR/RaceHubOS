import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import { fuelTelemetry } from '../../../frontend/src/lib/fuelTelemetry.mjs';
const sample = (patch = {}) =>
  fuelTelemetry({
    connected: true,
    socketConnected: true,
    receivedAt: 1000,
    now: 1100,
    status: { mode: 5, fuel: [10], pit: [false] },
    ...patch,
  });
test('Regler 1 uses slot 0 and the CU reading, not capacity', () => {
  const s = sample();
  assert.equal(s.raw, 10);
  assert.equal(s.ready, true);
  assert.equal(s.mode, 'on');
});
test('OFF and REAL do not permit the ON test', () => {
  for (const mode of [4, 6, 7]) assert.equal(sample({ status: { mode, fuel: [14] } }).ready, false);
});
test('stale, missing, disconnected and malformed readings are not shown as current', () => {
  for (const patch of [
    { now: 6001 },
    { receivedAt: null },
    { connected: false },
    { socketConnected: false },
    { status: { mode: 5, fuel: [null] } },
    { status: { mode: 5, fuel: [16] } },
    { status: { mode: 1, fuel: [0] } },
  ]) {
    const s = sample(patch);
    assert.equal(s.available, false);
    assert.equal(s.raw, null);
    assert.equal(s.ready, false);
  }
});
test('empty is a valid low reading, not missing data', () => {
  const s = sample({ status: { mode: 5, fuel: [0], pit: [true] } });
  assert.equal(s.raw, 0);
  assert.equal(s.low, true);
  assert.equal(s.inPit, true);
});
test('a pit status and increasing real readings remain separate from simulated refuelling', () => {
  for (const raw of [3, 7, 14]) {
    const s = sample({ status: { mode: 5, fuel: [raw], pit: [true] } });
    assert.equal(s.raw, raw);
    assert.equal(s.inPit, true);
  }
});
