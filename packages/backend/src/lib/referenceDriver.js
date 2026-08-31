import { SessionType } from '@racehubos/shared';
/**
 * Reference driver ("Le STIG"): the constant behind every balancing run.
 *
 * Balancing measures cars, not drivers — whoever holds the controller, the laps
 * belong to this single driver. That keeps balancing laps out of the real
 * drivers' statistics without having to filter by phase everywhere.
 */

const STIG_DEFAULTS = {
  name: 'Le STIG',
  color: '#E5E7EB',
};

/** @returns the reference driver, or null when none is configured */
export async function getReferenceDriver(prisma) {
  return prisma.driver.findFirst({
    where: { isReference: true, deletedAt: null },
    include: { team: true },
  });
}

/**
 * Make `driverId` the one and only reference driver.
 * Passing null simply clears the current one.
 */
export async function setReferenceDriver(prisma, driverId) {
  return prisma.$transaction(async (tx) => {
    await tx.driver.updateMany({ where: { isReference: true }, data: { isReference: false } });

    if (!driverId) return null;

    const driver = await tx.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new Error('Driver not found');
    if (driver.deletedAt) throw new Error('Cannot use a deleted driver as reference');

    await tx.driver.update({ where: { id: driverId }, data: { isReference: true } });
    return tx.driver.findUnique({ where: { id: driverId }, include: { team: true } });
  });
}

/**
 * Create "Le STIG" and make it the reference driver.
 * Reuses an existing driver with the same name rather than duplicating it.
 */
export async function createStig(prisma) {
  const existing = await prisma.driver.findFirst({
    where: { name: STIG_DEFAULTS.name, deletedAt: null },
  });

  const driver = existing ?? await prisma.driver.create({ data: STIG_DEFAULTS });
  return setReferenceDriver(prisma, driver.id);
}

/**
 * Reassign every past balancing lap — and its session entries — to the
 * reference driver, for installations that balanced before this existed.
 *
 * @returns {{laps: number, sessionDrivers: number}} how much was moved
 */
export async function migrateBalancingLaps(prisma, driverId) {
  return prisma.$transaction(async (tx) => {
    // NULL must be matched explicitly: in SQL, `driverId != x` is never true
    // for NULL, and balancing laps historically had no driver at all.
    const notReference = { OR: [{ driverId: null }, { driverId: { not: driverId } }] };

    const laps = await tx.lap.updateMany({
      where: { phase: SessionType.BALANCING, ...notReference },
      data: { driverId },
    });

    const balancingSessions = await tx.session.findMany({
      where: { type: SessionType.BALANCING },
      select: { id: true },
    });

    const sessionDrivers = await tx.sessionDriver.updateMany({
      where: {
        sessionId: { in: balancingSessions.map((s) => s.id) },
        ...notReference,
      },
      data: { driverId },
    });

    return { laps: laps.count, sessionDrivers: sessionDrivers.count };
  });
}
