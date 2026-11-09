import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { withImageUrl } from '../utils/imageUrl.js';
import { SessionType } from '@racehubos/shared';
import { route } from '../lib/http.js';
import { balancingBests, pairingBests } from '../lib/records/trackBests.js';

const router = express.Router();
const prisma = createPrismaClient();

const SESSION_PICK = { select: { id: true, type: true, name: true } };

/**
 * GET /api/records/track/:trackId?championshipId=null|<id>
 * The best laps on a track per session type — balancing per car — free sessions only with
 * `championshipId=null`, one championship's with its id.
 */
router.get(
  '/track/:trackId',
  route(null, async (req, res) => {
    const { trackId } = req.params;
    const { championshipId } = req.query;
    const inScope = championshipId ? { championshipId: championshipId === 'null' ? null : championshipId } : {};
    const lapsOf = (type) => ({ trackId, deletedAt: null, session: { type, ...inScope } });
    const bestsOf = (type) => pairingBests(prisma, lapsOf(type), type);

    const [practice, qualif, race, balancing, track] = await Promise.all([
      bestsOf(SessionType.PRACTICE),
      bestsOf(SessionType.QUALIF),
      bestsOf(SessionType.RACE),
      balancingBests(prisma, lapsOf(SessionType.BALANCING)),
      prisma.track.findUnique({ where: { id: trackId } }),
    ]);
    res.json({ success: true, data: { track: withImageUrl(track), practice, qualif, race, balancing } });
  })
);

/** GET /api/records/driver/:driverId | car/:carId - the track records held, fastest first */
for (const [owner, other] of [
  ['driver', 'car'],
  ['car', 'driver'],
]) {
  router.get(
    `/${owner}/:id`,
    route(null, async (req, res) => {
      const { id } = req.params;
      const records = await prisma.trackRecord.findMany({
        where: { [`${owner}Id`]: id },
        orderBy: { lapTime: 'asc' },
        include: { track: true, [other]: true, session: SESSION_PICK },
      });
      const holder = await prisma[owner].findUnique({ where: { id } });
      res.json({ success: true, data: { [owner]: holder, records, count: records.length } });
    })
  );
}

// GET /api/records/leaderboard?limit= - every track record, fastest first
router.get(
  '/leaderboard',
  route(null, async (req, res) => {
    const records = await prisma.trackRecord.findMany({
      orderBy: { lapTime: 'asc' },
      take: parseInt(req.query.limit ?? 50),
      include: { track: true, driver: true, car: true },
    });
    res.json({ success: true, data: records });
  })
);

router.delete(
  '/:id',
  route(null, async (req, res) => {
    await prisma.trackRecord.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Record deleted' });
  })
);

export default router;
