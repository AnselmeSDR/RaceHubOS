/**
 * The devices to offer: the known ones, then those of the last scan not known yet (`isNew`); the
 * simulator only in admin mode.
 */
export function offeredDevices(devices = [], scanResults = [], isAdmin = false) {
  const offered = devices.filter((device) => isAdmin || device.type !== 'simulator')
  for (const found of scanResults) {
    if (offered.some((device) => device.address === found.address)) continue
    if (!isAdmin && found.type === 'simulator') continue
    offered.push({ ...found, isNew: true })
  }
  return offered
}
