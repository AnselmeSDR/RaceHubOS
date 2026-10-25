import { selectNobleAdapter } from '../lib/nobleAdapter.js';
test('a sole nonzero Linux adapter is selected before Noble loads', () => {
  const env = {};
  selectNobleAdapter(env, 'linux', () => ['hci1']);
  expect(env.NOBLE_HCI_DEVICE_ID).toBe('1');
});
test('explicit adapter selection is preserved', () => {
  const env = { NOBLE_HCI_DEVICE_ID: '2' };
  selectNobleAdapter(env, 'linux', () => ['hci1']);
  expect(env.NOBLE_HCI_DEVICE_ID).toBe('2');
});
test('ambiguous adapters and other platforms are not guessed', () => {
  for (const [platform, names] of [
    ['linux', ['hci1', 'hci2']],
    ['linux', []],
    ['darwin', ['hci1']],
  ]) {
    const env = {};
    selectNobleAdapter(env, platform, () => names);
    expect(env.NOBLE_HCI_DEVICE_ID).toBeUndefined();
  }
});
