import { SessionStatus, SessionType } from '@racehubos/shared';
import { sessionName } from '../sessionNames.js';

/** The limits a new session of each type gets, from the creation body. */
export const limitsByType = (body) => ({
  [SessionType.PRACTICE]: { maxDuration: body.practiceMaxDuration || null, maxLaps: body.practiceMaxLaps || null },
  [SessionType.QUALIF]: { maxDuration: body.qualifMaxDuration || null, maxLaps: body.qualifMaxLaps || null },
  [SessionType.RACE]: { maxDuration: body.raceMaxDuration || null, maxLaps: body.raceMaxLaps || null },
});

/**
 * Creates the sessions of a championship planned by hand, in their running order, each driver on
 * its controller with their car in the championship (`cars`, by driver id). Qualifs and races are
 * numbered; free practices only when there are several.
 */
export async function createPlannedSessions(prisma, { championshipId, trackId, sessions, cars, body }) {
  const limits = limitsByType(body);
  const total = (type) => sessions.filter((s) => s.type === type).length;
  const seen = {};

  for (const [order, { type, drivers = [] }] of sessions.entries()) {
    seen[type] = (seen[type] ?? 0) + 1;
    const name = sessionName(type, body.sessionNames);
    const numbered = type !== SessionType.PRACTICE || total(type) > 1;
    await prisma.session.create({
      data: {
        name: numbered ? `${name} ${seen[type]}` : name,
        type,
        status: SessionStatus.DRAFT,
        championshipId,
        trackId,
        order,
        ...limits[type],
        drivers: {
          create: drivers.map(({ driverId, controller }) => ({
            driverId,
            controller,
            carId: cars.get(driverId) ?? null,
          })),
        },
      },
    });
  }
}

/**
 * The free practices a championship starts with: `count` of them, numbered when several, each
 * with the drivers of its group when `groups` are given (open to all otherwise).
 */
export const createPractices = (prisma, { championshipId, trackId, count, groups, cars, body }) =>
  createPlannedSessions(prisma, {
    championshipId,
    trackId,
    cars,
    body,
    sessions: Array.from({ length: count }, (_, p) => ({
      type: SessionType.PRACTICE,
      drivers: (groups?.[p] ?? []).map((driverId, controller) => ({ driverId, controller })),
    })),
  });
