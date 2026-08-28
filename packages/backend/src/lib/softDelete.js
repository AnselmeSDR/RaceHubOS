/**
 * Soft-delete cascades.
 *
 * Deleting an entity only used to mark that entity: its laps stayed active and
 * kept showing up in the statistics, while the "show deleted items" toggle only
 * ever looked at the laps themselves.
 *
 * Every row touched by one deletion shares the exact same timestamp. That is
 * what lets a later restore bring back only what was hidden by the cascade,
 * leaving rows deleted on purpose beforehand untouched.
 */

/** Rows already deleted keep their own timestamp — never re-stamp them. */
const active = { deletedAt: null };

/**
 * Delete a track, its championships and everything recorded on it.
 * @returns counts per table
 */
export async function softDeleteTrack(prisma, trackId) {
  const deletedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const championships = await tx.championship.findMany({
      where: { trackId },
      select: { id: true },
    });
    const championshipIds = championships.map((c) => c.id);

    // Sessions of this track, plus those of its championships wherever they run
    const sessionFilter = {
      OR: [{ trackId }, ...(championshipIds.length ? [{ championshipId: { in: championshipIds } }] : [])],
    };
    const sessions = await tx.session.findMany({ where: sessionFilter, select: { id: true } });
    const sessionIds = sessions.map((s) => s.id);

    const counts = {};
    counts.laps = (await tx.lap.updateMany({
      where: { ...active, OR: [{ trackId }, { sessionId: { in: sessionIds } }] },
      data: { deletedAt },
    })).count;

    counts.sessionDrivers = (await tx.sessionDriver.updateMany({
      where: { ...active, sessionId: { in: sessionIds } },
      data: { deletedAt },
    })).count;

    counts.sessions = (await tx.session.updateMany({
      where: { ...active, ...sessionFilter },
      data: { deletedAt },
    })).count;

    counts.championships = (await tx.championship.updateMany({
      where: { ...active, trackId },
      data: { deletedAt },
    })).count;

    counts.trackRecords = (await tx.trackRecord.updateMany({
      where: { ...active, trackId },
      data: { deletedAt },
    })).count;

    counts.participations = (await tx.championshipParticipant.updateMany({
      where: { ...active, championshipId: { in: championshipIds } },
      data: { deletedAt },
    })).count;

    await tx.track.update({ where: { id: trackId }, data: { deletedAt } });

    return { deletedAt, ...counts };
  });
}

/** Restore a track and only what its deletion hid. */
export async function restoreTrack(prisma, trackId) {
  return prisma.$transaction(async (tx) => {
    const track = await tx.track.findUnique({ where: { id: trackId } });
    if (!track) throw new Error('Track not found');

    const { deletedAt } = track;
    await tx.track.update({ where: { id: trackId }, data: { deletedAt: null } });
    if (!deletedAt) return { championships: 0, sessions: 0, sessionDrivers: 0, laps: 0, trackRecords: 0 };

    // Scope every restore to this track: the timestamp alone would also catch
    // rows hidden by a different deletion that happened in the same millisecond.
    const ofTrack = { OR: [{ trackId }, { championship: { trackId } }] };

    return {
      laps: (await tx.lap.updateMany({
        where: { deletedAt, OR: [{ trackId }, { session: ofTrack }] },
        data: { deletedAt: null },
      })).count,
      sessionDrivers: (await tx.sessionDriver.updateMany({
        where: { deletedAt, session: ofTrack },
        data: { deletedAt: null },
      })).count,
      sessions: (await tx.session.updateMany({
        where: { deletedAt, ...ofTrack },
        data: { deletedAt: null },
      })).count,
      championships: (await tx.championship.updateMany({
        where: { deletedAt, trackId },
        data: { deletedAt: null },
      })).count,
      participations: (await tx.championshipParticipant.updateMany({
        where: { deletedAt, championship: { trackId } },
        data: { deletedAt: null },
      })).count,
      trackRecords: (await tx.trackRecord.updateMany({
        where: { deletedAt, trackId },
        data: { deletedAt: null },
      })).count,
    };
  });
}

/** Delete a driver along with their laps and session entries. */
export async function softDeleteDriver(prisma, driverId) {
  const deletedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const laps = await tx.lap.updateMany({ where: { ...active, driverId }, data: { deletedAt } });
    const sessionDrivers = await tx.sessionDriver.updateMany({ where: { ...active, driverId }, data: { deletedAt } });
    // A record stands for one lap: hiding the lap must hide the record too
    const trackRecords = await tx.trackRecord.updateMany({ where: { ...active, driverId }, data: { deletedAt } });
    // Championship entries are hidden, not erased: the driver stays traceable
    const participations = await tx.championshipParticipant.updateMany({ where: { ...active, driverId }, data: { deletedAt } });
    await tx.driver.update({ where: { id: driverId }, data: { deletedAt } });

    return { deletedAt, laps: laps.count, sessionDrivers: sessionDrivers.count, trackRecords: trackRecords.count, participations: participations.count };
  });
}

/** Restore a driver and only what their deletion hid. */
export async function restoreDriver(prisma, driverId) {
  return prisma.$transaction(async (tx) => {
    const driver = await tx.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new Error('Driver not found');

    const { deletedAt } = driver;
    await tx.driver.update({ where: { id: driverId }, data: { deletedAt: null } });
    if (!deletedAt) return { laps: 0, sessionDrivers: 0, trackRecords: 0, participations: 0 };

    return {
      laps: (await tx.lap.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } })).count,
      sessionDrivers: (await tx.sessionDriver.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } })).count,
      trackRecords: (await tx.trackRecord.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } })).count,
      participations: (await tx.championshipParticipant.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } })).count,
    };
  });
}

/** Delete a car along with its laps and session entries. */
export async function softDeleteCar(prisma, carId) {
  const deletedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const laps = await tx.lap.updateMany({ where: { ...active, carId }, data: { deletedAt } });
    const sessionDrivers = await tx.sessionDriver.updateMany({ where: { ...active, carId }, data: { deletedAt } });
    // A record stands for one lap: hiding the lap must hide the record too
    const trackRecords = await tx.trackRecord.updateMany({ where: { ...active, carId }, data: { deletedAt } });
    await tx.car.update({ where: { id: carId }, data: { deletedAt } });

    return { deletedAt, laps: laps.count, sessionDrivers: sessionDrivers.count, trackRecords: trackRecords.count };
  });
}

/** Restore a car and only what its deletion hid. */
export async function restoreCar(prisma, carId) {
  return prisma.$transaction(async (tx) => {
    const car = await tx.car.findUnique({ where: { id: carId } });
    if (!car) throw new Error('Car not found');

    const { deletedAt } = car;
    await tx.car.update({ where: { id: carId }, data: { deletedAt: null } });
    if (!deletedAt) return { laps: 0, sessionDrivers: 0, trackRecords: 0 };

    return {
      laps: (await tx.lap.updateMany({ where: { carId, deletedAt }, data: { deletedAt: null } })).count,
      sessionDrivers: (await tx.sessionDriver.updateMany({ where: { carId, deletedAt }, data: { deletedAt: null } })).count,
      trackRecords: (await tx.trackRecord.updateMany({ where: { carId, deletedAt }, data: { deletedAt: null } })).count,
    };
  });
}
