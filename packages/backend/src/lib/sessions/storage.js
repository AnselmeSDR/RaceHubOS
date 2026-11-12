import { SESSION_TYPES, SessionStatus, SessionType, isSessionType } from '@racehubos/shared';
import { sessionName } from '../sessionNames.js';

/** Where a new session runs: its track, else its championship's. Throws when it has none. */
async function trackOf(prisma, { trackId, championshipId }) {
  if (trackId) return trackId;
  if (!championshipId) throw new Error('trackId or championshipId required');
  const championship = await prisma.championship.findUnique({ where: { id: championshipId } });
  if (!championship?.trackId) throw new Error('Championship has no track assigned');
  return championship.trackId;
}

/** Driver ids in the order of the track's last finished qualifying, or null without one. */
async function qualifyingOrder(prisma, trackId) {
  const qualifying = await prisma.session.findFirst({
    where: { trackId, type: SessionType.QUALIF, status: SessionStatus.FINISHED, deletedAt: null },
    orderBy: { finishedAt: 'desc' },
    include: { drivers: { where: { deletedAt: null }, orderBy: { finalPos: 'asc' } } },
  });
  return qualifying ? qualifying.drivers.map((d) => d.driverId) : null;
}

/**
 * Creates a session with an entry for each controller of its track set with a driver and a car.
 * A race is gridded in controller order, or by the last qualifying (`gridFromQualifying`), those
 * missing from it at the back. Returns the session with its track, championship and entries.
 */
export async function createSessionFromControllers(prisma, params) {
  const { type, name, championshipId, maxDuration, maxLaps, order, gridFromQualifying, status, sessionNames } = params;
  if (!isSessionType(type)) {
    throw new Error(`Invalid session type. Must be one of: ${SESSION_TYPES.join(', ')}`);
  }
  const trackId = await trackOf(prisma, params);
  const isRace = type === SessionType.RACE;

  const session = await prisma.session.create({
    data: {
      name: name || sessionName(type, sessionNames),
      type,
      status: status || SessionStatus.DRAFT,
      trackId,
      championshipId: championshipId || null,
      maxDuration: maxDuration || null,
      maxLaps: maxLaps || null,
      order: order ?? 0,
    },
  });

  const configs = await prisma.controllerConfig.findMany({ where: { trackId } });
  const gridOrder = isRace && gridFromQualifying ? await qualifyingOrder(prisma, trackId) : null;
  for (const [i, config] of configs.entries()) {
    if (!config.driverId || !config.carId) continue;
    const gridPos = gridOrder ? gridOrder.indexOf(config.driverId) + 1 || configs.length : i + 1;
    await prisma.sessionDriver.create({
      data: {
        sessionId: session.id,
        driverId: config.driverId,
        carId: config.carId,
        controller: config.controller,
        gridPos: isRace ? gridPos : null,
      },
    });
  }

  return prisma.session.findUnique({
    where: { id: session.id },
    include: {
      track: true,
      championship: true,
      drivers: {
        include: { driver: true, car: true },
        orderBy: isRace ? { gridPos: 'asc' } : { controller: 'asc' },
      },
    },
  });
}

/** Back to draft: its laps hidden (they stay in the statistics' history), its entries zeroed, its times cleared. */
export async function resetStoredSession(prisma, sessionId) {
  await prisma.$transaction([
    prisma.lap.updateMany({ where: { sessionId, deletedAt: null }, data: { deletedAt: new Date() } }),
    prisma.sessionDriver.updateMany({
      where: { sessionId },
      data: {
        position: null,
        finalPos: null,
        totalLaps: 0,
        totalTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        isDNF: false,
        lapsAtFinishing: null,
      },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.DRAFT, startedAt: null, finishingAt: null, finishedAt: null, pauses: null },
    }),
  ]);
}
