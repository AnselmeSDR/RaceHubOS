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
    counts.laps = (
      await tx.lap.updateMany({
        where: { ...active, OR: [{ trackId }, { sessionId: { in: sessionIds } }] },
        data: { deletedAt },
      })
    ).count;

    counts.sessionDrivers = (
      await tx.sessionDriver.updateMany({
        where: { ...active, sessionId: { in: sessionIds } },
        data: { deletedAt },
      })
    ).count;

    counts.sessions = (
      await tx.session.updateMany({
        where: { ...active, ...sessionFilter },
        data: { deletedAt },
      })
    ).count;

    counts.championships = (
      await tx.championship.updateMany({
        where: { ...active, trackId },
        data: { deletedAt },
      })
    ).count;

    counts.trackRecords = (
      await tx.trackRecord.updateMany({
        where: { ...active, trackId },
        data: { deletedAt },
      })
    ).count;

    counts.participations = (
      await tx.championshipParticipant.updateMany({
        where: { ...active, championshipId: { in: championshipIds } },
        data: { deletedAt },
      })
    ).count;

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
      laps: (
        await tx.lap.updateMany({
          where: { deletedAt, OR: [{ trackId }, { session: ofTrack }] },
          data: { deletedAt: null },
        })
      ).count,
      sessionDrivers: (
        await tx.sessionDriver.updateMany({
          where: { deletedAt, session: ofTrack },
          data: { deletedAt: null },
        })
      ).count,
      sessions: (
        await tx.session.updateMany({
          where: { deletedAt, ...ofTrack },
          data: { deletedAt: null },
        })
      ).count,
      championships: (
        await tx.championship.updateMany({
          where: { deletedAt, trackId },
          data: { deletedAt: null },
        })
      ).count,
      participations: (
        await tx.championshipParticipant.updateMany({
          where: { deletedAt, championship: { trackId } },
          data: { deletedAt: null },
        })
      ).count,
      trackRecords: (
        await tx.trackRecord.updateMany({
          where: { deletedAt, trackId },
          data: { deletedAt: null },
        })
      ).count,
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
    const participations = await tx.championshipParticipant.updateMany({
      where: { ...active, driverId },
      data: { deletedAt },
    });
    await tx.driver.update({ where: { id: driverId }, data: { deletedAt } });

    return {
      deletedAt,
      laps: laps.count,
      sessionDrivers: sessionDrivers.count,
      trackRecords: trackRecords.count,
      participations: participations.count,
    };
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
      sessionDrivers: (await tx.sessionDriver.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } }))
        .count,
      trackRecords: (await tx.trackRecord.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } }))
        .count,
      participations: (
        await tx.championshipParticipant.updateMany({ where: { driverId, deletedAt }, data: { deletedAt: null } })
      ).count,
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
      sessionDrivers: (await tx.sessionDriver.updateMany({ where: { carId, deletedAt }, data: { deletedAt: null } }))
        .count,
      trackRecords: (await tx.trackRecord.updateMany({ where: { carId, deletedAt }, data: { deletedAt: null } })).count,
    };
  });
}

/** Delete a championship with its sessions, their entries and laps; its participants are hidden. */
export async function softDeleteChampionship(prisma, championshipId) {
  const deletedAt = new Date();
  const ofChampionship = { session: { championshipId } };
  await prisma.$transaction([
    prisma.lap.updateMany({ where: { ...active, ...ofChampionship }, data: { deletedAt } }),
    prisma.sessionDriver.updateMany({ where: { ...active, ...ofChampionship }, data: { deletedAt } }),
    prisma.session.updateMany({ where: { ...active, championshipId }, data: { deletedAt } }),
    prisma.championshipParticipant.updateMany({ where: { ...active, championshipId }, data: { deletedAt } }),
    prisma.championship.update({ where: { id: championshipId }, data: { deletedAt } }),
  ]);
  return { deletedAt };
}

/** Restore a championship and only what its deletion hid. */
export async function restoreChampionship(prisma, championshipId) {
  const championship = await prisma.championship.findUnique({ where: { id: championshipId } });
  if (!championship) throw new Error('Championship not found');
  const { deletedAt } = championship;
  const ofChampionship = { session: { championshipId } };
  const restored = { deletedAt: null };
  await prisma.$transaction([
    prisma.championship.update({ where: { id: championshipId }, data: restored }),
    ...(deletedAt
      ? [
          prisma.session.updateMany({ where: { deletedAt, championshipId }, data: restored }),
          prisma.championshipParticipant.updateMany({ where: { deletedAt, championshipId }, data: restored }),
          prisma.sessionDriver.updateMany({ where: { deletedAt, ...ofChampionship }, data: restored }),
          prisma.lap.updateMany({ where: { deletedAt, ...ofChampionship }, data: restored }),
        ]
      : []),
  ]);
}

/** Erase a championship for good: its laps, entries and sessions first (participants cascade). */
export async function purgeChampionship(prisma, championshipId) {
  const ofChampionship = { session: { championshipId } };
  await prisma.$transaction([
    prisma.lap.deleteMany({ where: ofChampionship }),
    prisma.sessionDriver.deleteMany({ where: ofChampionship }),
    prisma.session.deleteMany({ where: { championshipId } }),
    prisma.championship.delete({ where: { id: championshipId } }),
  ]);
}

/** Restore a session with its entries, laps and records hidden by the same deletion. */
export async function restoreSession(prisma, sessionId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  const { deletedAt } = session;
  const restored = { deletedAt: null };
  await prisma.$transaction([
    prisma.session.update({ where: { id: sessionId }, data: restored }),
    ...(deletedAt
      ? [
          prisma.sessionDriver.updateMany({ where: { deletedAt, sessionId }, data: restored }),
          prisma.lap.updateMany({ where: { deletedAt, sessionId }, data: restored }),
          prisma.trackRecord.updateMany({ where: { deletedAt, sessionId }, data: restored }),
        ]
      : []),
  ]);
}

/** Erase a session for good, its laps and entries first. */
export async function purgeSession(prisma, sessionId) {
  await prisma.$transaction([
    prisma.lap.deleteMany({ where: { sessionId } }),
    prisma.sessionDriver.deleteMany({ where: { sessionId } }),
    prisma.session.delete({ where: { id: sessionId } }),
  ]);
}

/** Erase a car for good, with every entry, lap, controller setting and record under it. */
export async function purgeCar(prisma, carId) {
  await prisma.$transaction([
    prisma.sessionDriver.deleteMany({ where: { carId } }),
    prisma.lap.deleteMany({ where: { carId } }),
    prisma.controllerConfig.deleteMany({ where: { carId } }),
    prisma.trackRecord.deleteMany({ where: { carId } }),
    prisma.car.delete({ where: { id: carId } }),
  ]);
}

/** Erase a driver for good, with every lap, entry, participation, controller setting and record under them. */
export async function purgeDriver(prisma, driverId) {
  await prisma.$transaction([
    prisma.lap.deleteMany({ where: { driverId } }),
    prisma.sessionDriver.deleteMany({ where: { driverId } }),
    prisma.trackRecord.deleteMany({ where: { driverId } }),
    prisma.championshipParticipant.deleteMany({ where: { driverId } }),
    prisma.controllerConfig.deleteMany({ where: { driverId } }),
    prisma.driver.delete({ where: { id: driverId } }),
  ]);
}

/**
 * Erase a track for good, with what its deletion hid: its championships, their sessions wherever
 * they run, its own sessions, and every lap, entry, controller setting and record under them.
 */
export async function purgeTrack(prisma, trackId) {
  await prisma.$transaction(async (tx) => {
    const championships = await tx.championship.findMany({ where: { trackId }, select: { id: true } });
    const championshipIds = championships.map((c) => c.id);
    const sessionFilter = { OR: [{ trackId }, { championshipId: { in: championshipIds } }] };

    await tx.lap.deleteMany({ where: { OR: [{ trackId }, { session: sessionFilter }] } });
    await tx.sessionDriver.deleteMany({ where: { session: sessionFilter } });
    await tx.trackRecord.deleteMany({ where: { trackId } });
    await tx.controllerConfig.deleteMany({ where: { trackId } });
    await tx.session.deleteMany({ where: sessionFilter });
    // Participants cascade with their championship
    await tx.championship.deleteMany({ where: { id: { in: championshipIds } } });
    await tx.track.delete({ where: { id: trackId } });
  });
}
