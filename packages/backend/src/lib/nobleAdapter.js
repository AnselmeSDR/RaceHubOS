import { readdirSync } from 'node:fs';

/** Respect explicit selection; Linux HCI numbers need not start at zero. */
export function selectNobleAdapter(
  env = process.env,
  platform = process.platform,
  list = () => readdirSync('/sys/class/bluetooth')
) {
  if (platform !== 'linux' || env.NOBLE_HCI_DEVICE_ID !== undefined) return;
  let names;
  try {
    names = list();
  } catch {
    return;
  }
  const ids = names
    .filter((name) => /^hci\d+$/.test(name))
    .map((name) => Number(name.slice(3)))
    .sort((a, b) => a - b);
  if (ids.length === 1) env.NOBLE_HCI_DEVICE_ID = String(ids[0]);
}
