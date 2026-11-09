/**
 * Reconnects the Control Unit used last, when the `autoConnect` preference is on. A failure is
 * only logged: the server runs without a device.
 */
export async function autoConnect({ prisma, syncService, controlUnit }) {
  try {
    const preference = await prisma.preference.findUnique({ where: { key: 'autoConnect' } });
    if (!preference || JSON.parse(preference.value) !== true) return;

    const lastDevice = await prisma.device.findFirst({ where: { type: 'cu' }, orderBy: { lastConnected: 'desc' } });
    if (!lastDevice) return;

    console.log(`🔄 Auto-connecting to ${lastDevice.name} (${lastDevice.address})...`);
    try {
      syncService.setDevice(controlUnit);
      await controlUnit.connect(lastDevice.address);
      syncService.startPolling();
      console.log('✅ Auto-connected to Control Unit');
    } catch (err) {
      console.warn('⚠️  Auto-connect failed:', err.message);
    }
  } catch (err) {
    console.warn('⚠️  Auto-connect check failed:', err.message);
  }
}
