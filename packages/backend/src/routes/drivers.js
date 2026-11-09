import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { attachExtras } from '../addons/extras.js';
import { softDeleteDriver, restoreDriver } from '../lib/softDelete.js';
import { getReferenceDriver, setReferenceDriver, createStig, migrateBalancingLaps } from '../lib/referenceDriver.js';
import { uniqueConstraintFields } from '../lib/prismaErrors.js';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';
import { driverWorkbook, driversWorkbook, idsFromQuery, sendWorkbook } from '../lib/exportQueries.js';
import { findOr404, HttpError, route } from '../lib/http.js';
import { addDeletionRoutes } from '../lib/entities/deletion.js';
import { changesFrom, kept, orNull, trimmed, trimmedOrNull } from '../lib/entities/fields.js';
import { byBestLap, byTeamName, listPage } from '../lib/entities/list.js';
import { bestLapRecords } from '../lib/entities/records.js';

const router = express.Router();
const prisma = createPrismaClient();

const notDeleted = { where: { deletedAt: null } };
const LIST = {
  sortBy: 'name',
  include: { team: true, _count: { select: { laps: notDeleted, sessions: notDeleted } } },
  counts: ['sessions', 'laps'],
  computed: { team: byTeamName, bestLap: byBestLap },
};

/** A number or an email already used by another driver is a 400, not a server failure. */
function refuseTaken(error) {
  if (error.code !== 'P2002') throw error;
  const field = uniqueConstraintFields(error)[0];
  throw new HttpError(400, `${field === 'number' ? 'Number' : 'Email'} already exists`);
}

const withImage = (driver) => (driver ? withImageUrl(driver) : null);

// GET /api/drivers - filtered (deleted), sorted and paginated
router.get(
  '/',
  route('Failed to fetch drivers', async (req, res) => {
    const { page, ...rest } = await listPage(prisma.driver, req.query, LIST);
    res.json({ success: true, data: await attachExtras(prisma, 'driver', page.map(withNestedImageUrls)), ...rest });
  })
);

// GET /api/drivers/reference - the reference driver, null when none is set
router.get(
  '/reference',
  route(null, async (req, res) => {
    res.json({ success: true, data: withImage(await getReferenceDriver(prisma)) });
  })
);

// PUT /api/drivers/reference - Body: { driverId }, null clears it
router.put(
  '/reference',
  route(
    null,
    async (req, res) => {
      res.json({ success: true, data: withImage(await setReferenceDriver(prisma, req.body.driverId ?? null)) });
    },
    400
  )
);

// POST /api/drivers/reference/stig - creates "Le STIG" as reference driver
router.post(
  '/reference/stig',
  route(
    null,
    async (req, res) => {
      res.status(201).json({ success: true, data: withImageUrl(await createStig(prisma)) });
    },
    400
  )
);

// POST /api/drivers/reference/migrate-balancing - past balancing laps move onto the reference driver
router.post(
  '/reference/migrate-balancing',
  route(null, async (req, res) => {
    const reference = await getReferenceDriver(prisma);
    if (!reference) throw new HttpError(400, 'No reference driver configured');
    const moved = await migrateBalancingLaps(prisma, reference.id);
    res.json({ success: true, data: { driver: withImageUrl(reference), ...moved } });
  })
);

// GET /api/drivers/export?ids=a,b,c - Excel workbook for a hand-picked set of drivers
router.get(
  '/export',
  route(null, async (req, res) => {
    const result = await driversWorkbook(prisma, idsFromQuery(req.query.ids));
    if (!result) throw new HttpError(404, 'No driver to export');
    await sendWorkbook(res, result);
  })
);

// GET /api/drivers/:id/export - Excel workbook centred on one driver
router.get(
  '/:id/export',
  route(null, async (req, res) => {
    const result = await driverWorkbook(prisma, req.params.id);
    if (!result) throw new HttpError(404, 'Driver not found');
    await sendWorkbook(res, result);
  })
);

// GET /api/drivers/:id - with team, latest sessions, counts and best lap per car and track
router.get(
  '/:id',
  route('Failed to fetch driver', async (req, res) => {
    const driver = await findOr404(prisma.driver, req.params.id, 'Driver', {
      team: true,
      sessions: {
        include: { session: { include: { track: true } } },
        orderBy: { session: { createdAt: 'desc' } },
        take: 10,
      },
      _count: { select: { sessions: true, laps: true } },
    });
    const records = await bestLapRecords(prisma, 'driver', driver.id);
    res.json({
      success: true,
      data: await attachExtras(prisma, 'driver', withNestedImageUrls({ ...driver, records })),
    });
  })
);

router.post(
  '/',
  route('Failed to create driver', async (req, res) => {
    const { name, number, email, img, color, teamId } = req.body;
    if (!name?.trim()) throw new HttpError(400, 'Name is required');

    const driver = await prisma.driver
      .create({
        data: {
          name: name.trim(),
          number: number || null,
          email: email?.trim() || null,
          img: img || null,
          color: color || '#3B82F6',
          teamId: teamId || null,
        },
        include: { team: true },
      })
      .catch(refuseTaken);
    res.status(201).json({ success: true, data: withNestedImageUrls(driver) });
  })
);

const EDITABLE = { name: trimmed, number: orNull, email: trimmedOrNull, img: kept, color: kept, teamId: orNull };

router.put(
  '/:id',
  route('Failed to update driver', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.driver, id, 'Driver');
    const driver = await prisma.driver
      .update({ where: { id }, data: changesFrom(req.body, EDITABLE), include: { team: true } })
      .catch(refuseTaken);
    res.json({ success: true, data: withNestedImageUrls(driver) });
  })
);

addDeletionRoutes(router, {
  name: 'Driver',
  model: prisma.driver,
  hide: (id) => softDeleteDriver(prisma, id),
  erase: (id) => prisma.driver.delete({ where: { id } }),
  restore: (id) => restoreDriver(prisma, id),
});

// GET /api/drivers/:id/stats - sessions, laps, wins, podiums, best and average lap
router.get(
  '/:id/stats',
  route('Failed to fetch driver statistics', async (req, res) => {
    const driver = await findOr404(prisma.driver, req.params.id, 'Driver', { sessions: true, laps: true });
    const totalSessions = driver.sessions.length;
    const totalLaps = driver.laps.length;
    const wins = driver.sessions.filter((s) => s.finalPos === 1).length;
    const podiums = driver.sessions.filter((s) => s.finalPos && s.finalPos <= 3).length;
    const rate = (count) => (totalSessions > 0 ? (count / totalSessions) * 100 : 0);

    res.json({
      success: true,
      data: {
        driver: { id: driver.id, name: driver.name },
        stats: {
          totalSessions,
          totalLaps,
          wins,
          podiums,
          bestLapTime: driver.bestLap,
          avgLapTime: totalLaps > 0 ? driver.laps.reduce((sum, lap) => sum + lap.lapTime, 0) / totalLaps : null,
          winRate: rate(wins),
          podiumRate: rate(podiums),
        },
      },
    });
  })
);

// POST /api/drivers/:id/reset-stats - erases laps, entries and records, zeroes the totals
router.post(
  '/:id/reset-stats',
  route('Failed to reset driver statistics', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.driver, id, 'Driver');
    const driver = await prisma.$transaction(async (tx) => {
      for (const model of ['lap', 'sessionDriver', 'trackRecord'])
        await tx[model].deleteMany({ where: { driverId: id } });
      return tx.driver.update({
        where: { id },
        data: { totalRaces: 0, wins: 0, podiums: 0, bestLap: null },
        include: { team: true, _count: { select: { sessions: true, laps: true } } },
      });
    });
    res.json({ success: true, data: withNestedImageUrls(driver), message: 'Statistics reset successfully' });
  })
);

export default router;
