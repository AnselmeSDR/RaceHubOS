import { CAR_SPECS } from '@racehubos/shared';

export const hasCockpitCatalog = (prisma) => Boolean(prisma.catalogEntry);

export function cockpitCatalogCandidates(selected, enabled, prisma) {
  if (typeof enabled !== 'boolean') throw Object.assign(new Error('Invalid catalog selection'), { status: 400 });
  const result = new Map();
  if (!enabled) return result;
  if (!hasCockpitCatalog(prisma)) throw Object.assign(new Error('Local catalog is not installed'), { status: 400 });
  const references = new Set();
  for (const row of selected.cars) {
    const serial = row.catalogSerial?.trim();
    if (!serial || serial.length > 10000 || references.has(serial))
      throw Object.assign(new Error('Catalog references must be present and unique'), { status: 400 });
    references.add(serial);
    const data = { serial };
    for (const key of ['brand', 'model', 'year', 'img', ...CAR_SPECS]) {
      const value = row.data[key];
      if (typeof value === 'string' && value.length > 10000)
        throw Object.assign(new Error('Catalog field too long: ' + key), { status: 400 });
      data[key] = typeof value === 'string' ? value.trim() || null : (value ?? null);
    }
    if (data.img && !/^\/api\/img\/cars\/[a-zA-Z0-9_-]+\.(png|jpe?g|gif|webp)$/.test(data.img))
      throw Object.assign(new Error('Catalog photos must be local car images'), { status: 400 });
    if (!data.brand || !data.model)
      throw Object.assign(new Error('Catalog brand and model are required'), { status: 400 });
    result.set(row.key, data);
  }
  return result;
}

export async function storeCockpitCatalog(tx, candidate, row, img, id, writeImage) {
  const existing = await tx.catalogEntry.findUnique({ where: { serial: candidate.serial } });
  if (!existing) {
    const photo = row.targetId && row.image ? await writeImage(row, 'cars') : img;
    await tx.catalogEntry.create({ data: { ...candidate, img: photo || null } });
  }
  if (!row.targetId) await tx.car.update({ where: { id }, data: { serial: candidate.serial } });
  return existing ? 'catalogSkipped' : 'catalogImported';
}
