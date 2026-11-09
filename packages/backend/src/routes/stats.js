import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { SessionType } from '@racehubos/shared';
import { carStats, driverStats, trackStats } from '../lib/stats/entities.js';
import { sessionFilterOf } from '../lib/stats/figures.js';
import { bestLapsOf, LAP_INCLUDE, lapOrderBy, lapRow, lapTimesWhere } from '../lib/stats/lapTimes.js';
import { overallLeaderboard, sessionLeaderboard, teamLeaderboard } from '../lib/stats/leaderboards.js';
import { lapRecord, mostEntries } from '../lib/stats/records.js';

const router = express.Router();
const prisma = createPrismaClient();

/** Runs `handler`, answering 500 with `failure` when it throws. */
const route = (failure, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`${failure}:`, error);
    res.status(500).json({ success: false, error: failure });
  }
};

const withSession = { include: { session: true } };

// GET /api/stats/drivers?championshipId=&trackId=&has_championship=
router.get(
  '/drivers',
  route('Failed to fetch driver statistics', async (req, res) => {
    const filter = sessionFilterOf(req.query);
    const drivers = await prisma.driver.findMany({
      include: {
        laps: filter ? { where: { session: filter } } : true,
        sessions: { where: filter ? { session: filter } : undefined, ...withSession },
        team: true,
      },
    });
    const { championshipId, trackId } = req.query;
    res.json({ success: true, data: driverStats(drivers), filters: { championshipId, trackId } });
  })
);

// GET /api/stats/cars?championshipId=&trackId=
router.get(
  '/cars',
  route('Failed to fetch car statistics', async (req, res) => {
    const { championshipId, trackId } = req.query;
    const filter = sessionFilterOf({ championshipId, trackId });
    const cars = await prisma.car.findMany({
      include: {
        laps: filter ? { where: { session: filter } } : true,
        sessions: filter ? { where: { session: filter }, ...withSession } : withSession,
      },
    });
    res.json({ success: true, data: carStats(cars), filters: { championshipId, trackId } });
  })
);

// GET /api/stats/tracks
router.get(
  '/tracks',
  route('Failed to fetch track statistics', async (req, res) => {
    const tracks = await prisma.track.findMany({
      include: {
        sessions: {
          include: { laps: { orderBy: { lapTime: 'asc' }, take: 1 }, _count: { select: { laps: true } } },
        },
      },
    });
    res.json({ success: true, data: trackStats(tracks) });
  })
);

// GET /api/stats/leaderboard/drivers?sessionId=&phase= | ?championshipId= | ?limit=
router.get(
  '/leaderboard/drivers',
  route('Failed to fetch driver leaderboard', async (req, res) => {
    const { sessionId, championshipId, phase, limit = 10 } = req.query;
    let leaderboard = [];

    if (sessionId) {
      const entries = await prisma.sessionDriver.findMany({
        where: { sessionId, deletedAt: null },
        include: {
          driver: true,
          car: true,
          session: { include: { laps: { where: { sessionId, ...(phase && { phase }) } } } },
        },
        orderBy: [{ finalPos: 'asc' }, { position: 'asc' }],
      });
      leaderboard = sessionLeaderboard(entries, phase);
    } else if (!championshipId) {
      // A championship's standings live at GET /championships/:id/standings: empty here, kept for compatibility
      const drivers = await prisma.driver.findMany({
        include: { sessions: { where: { session: { type: SessionType.RACE } } } },
        take: parseInt(limit),
      });
      leaderboard = overallLeaderboard(drivers);
    }

    res.json({ success: true, data: leaderboard, filters: { sessionId, championshipId, limit } });
  })
);

// GET /api/stats/leaderboard/teams?championshipId=
router.get(
  '/leaderboard/teams',
  route('Failed to fetch team leaderboard', async (req, res) => {
    const { championshipId } = req.query;
    const races = { type: SessionType.RACE, ...(championshipId && { championshipId }) };
    const teams = await prisma.team.findMany({
      include: { drivers: { include: { sessions: { where: { session: races } } } } },
    });
    res.json({ success: true, data: teamLeaderboard(teams), filters: { championshipId } });
  })
);

// GET /api/stats/laptimes - every lap, or each driver, car and track's best (unique=true, the default)
router.get(
  '/laptimes',
  route('Failed to fetch lap times', async (req, res) => {
    const { driverId, carId, trackId, sessionType } = req.query;
    const { limit = 50, offset = 0, sortBy = 'lapTime', sortOrder = 'asc', unique = 'true' } = req.query;
    const start = parseInt(offset);
    const size = parseInt(limit);
    const where = lapTimesWhere(req.query);
    const orderBy = lapOrderBy(sortBy, sortOrder);

    let page, hasMore, total;
    if (unique === 'true') {
      // Every lap is read to keep the best of each, then the page is cut
      const laps = await prisma.lap.findMany({ where, orderBy, include: LAP_INCLUDE });
      const best = bestLapsOf(laps, sortBy, sortOrder);
      total = best.length;
      page = best.slice(start, start + size);
      hasMore = start + size < total;
    } else {
      const [laps, count] = await Promise.all([
        prisma.lap.findMany({ where, orderBy, skip: start, take: size + 1, include: LAP_INCLUDE }),
        prisma.lap.count({ where }),
      ]);
      hasMore = laps.length > size;
      page = laps.slice(0, size);
      total = count;
    }

    res.json({
      success: true,
      data: page.map(lapRow),
      total,
      hasMore,
      filters: { driverId, carId, trackId, sessionType, limit, offset, sortBy, sortOrder, unique },
    });
  })
);

// GET /api/stats/records?has_championship= - fastest lap, most wins, podiums and pole positions
router.get(
  '/records',
  route('Failed to fetch records', async (req, res) => {
    const inChampionships = req.query.has_championship === 'true' ? { championshipId: { not: null } } : {};
    const fastestLap = await prisma.lap.findFirst({
      where: { deletedAt: null, session: inChampionships },
      orderBy: { lapTime: 'asc' },
      include: { driver: true, car: true, session: { include: { track: true } } },
    });
    const driversWith = (entry) =>
      prisma.driver.findMany({
        include: { sessions: { where: { ...entry, session: { type: SessionType.RACE, ...inChampionships } } } },
      });

    res.json({
      success: true,
      data: {
        fastestLap: lapRecord(fastestLap),
        mostWins: mostEntries(await driversWith({ finalPos: 1 })),
        mostPodiums: mostEntries(await driversWith({ finalPos: { in: [1, 2, 3] } })),
        mostPolePositions: mostEntries(await driversWith({ gridPos: 1 })),
      },
    });
  })
);

// DELETE /api/stats/laps/:id - hidden first, erased when already hidden
router.delete(
  '/laps/:id',
  route('Failed to delete lap', async (req, res) => {
    const { id } = req.params;
    const lap = await prisma.lap.findUnique({ where: { id } });
    if (!lap) return res.status(404).json({ success: false, error: 'Lap not found' });

    if (lap.deletedAt) await prisma.lap.delete({ where: { id } });
    else await prisma.lap.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true, message: 'Lap deleted' });
  })
);

// PATCH /api/stats/laps/:id/restore
router.patch(
  '/laps/:id/restore',
  route('Failed to restore lap', async (req, res) => {
    const { id } = req.params;
    if (!(await prisma.lap.findUnique({ where: { id } }))) {
      return res.status(404).json({ success: false, error: 'Lap not found' });
    }
    await prisma.lap.update({ where: { id }, data: { deletedAt: null } });
    res.json({ success: true, message: 'Lap restored' });
  })
);

export default router;
