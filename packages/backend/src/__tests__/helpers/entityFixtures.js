import express from 'express';
import request from 'supertest';
import { SessionStatus, SessionType } from '@racehubos/shared';

/** A supertest client for `router` mounted at `path`. */
export function apiFor(path, router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return request(app);
}

/** Empties every table the entity routes touch, children first. */
export async function wipe(prisma) {
  for (const model of ['carExtra', 'driverExtra', 'trackExtra', 'teamExtra', 'sessionExtra', 'championshipExtra']) {
    await prisma[model].deleteMany();
  }
  for (const model of [
    'trackRecord',
    'controllerConfig',
    'lap',
    'sessionDriver',
    'championshipParticipant',
    'session',
    'championship',
    'driver',
    'car',
    'track',
    'team',
  ]) {
    await prisma[model].deleteMany();
  }
}

/** Builders for sessions, entries and laps, numbering laps in creation order. */
export function recorder(prisma) {
  let lapNumber = 0;
  return {
    session: (track, data = {}) =>
      prisma.session.create({
        data: { type: SessionType.RACE, status: SessionStatus.FINISHED, trackId: track.id, ...data },
      }),
    entry: (session, driver, car, data = {}) =>
      prisma.sessionDriver.create({
        data: { sessionId: session.id, driverId: driver?.id ?? null, carId: car?.id ?? null, controller: 0, ...data },
      }),
    lap: (session, driver, car, lapTime, data = {}) =>
      prisma.lap.create({
        data: {
          sessionId: session.id,
          trackId: session.trackId,
          driverId: driver?.id ?? null,
          carId: car.id,
          controller: 0,
          phase: session.type,
          lapNumber: ++lapNumber,
          lapTime,
          ...data,
        },
      }),
  };
}
