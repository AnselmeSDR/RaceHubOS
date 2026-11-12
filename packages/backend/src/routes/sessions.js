import express from 'express';
import { attachExtras } from '../addons/extras.js';
import { getReferenceDriver } from '../lib/referenceDriver.js';
import { SessionType } from '@racehubos/shared';
import { idsFromQuery, sendWorkbook, sessionWorkbook, sessionsWorkbook } from '../lib/exportQueries.js';
import { purgeSession, restoreSession } from '../lib/softDelete.js';
import { ACTIONS, applyTransition, statusError, transitionError } from '../lib/sessions/lifecycle.js';
import { isComputedSort, LIST_INCLUDE, listWhere, sortComputed, sortField } from '../lib/sessions/list.js';
import { storedLeaderboard } from '../lib/sessions/storedLeaderboard.js';
import { HttpError, route } from '../lib/http.js';
import { PEOPLE_INCLUDE, plainDivisions } from '../lib/divisions.js';
import { changesFrom, kept, orNull } from '../lib/entities/fields.js';

const router = express.Router();
let sessionService;

export function setSessionService(service) {
  sessionService = service;
}

const prisma = () => sessionService.prisma;

const withPeople = { include: PEOPLE_INCLUDE };
/** A session as the actions return it: track, championship and entries. */
const SESSION_INCLUDE = { track: true, championship: true, drivers: withPeople };

const notFound = (res) => res.status(404).json({ success: false, error: 'Session not found' });
const findSession = async (id, include) =>
  plainDivisions(await prisma().session.findUnique({ where: { id }, include }));

// GET /api/sessions - filtered (status, trackId, type, championshipId, deleted), sorted and paginated
router.get(
  '/',
  route(null, async (req, res) => {
    const { limit = '50', offset = '0', sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
    const where = listWhere(req.query);
    const field = sortField(sortBy);
    const computed = isComputedSort(field);
    const start = parseInt(offset);
    const size = parseInt(limit);

    const [found, total] = await Promise.all([
      prisma().session.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: computed ? undefined : { [field]: sortOrder },
        ...(computed ? {} : { skip: start, take: size }),
      }),
      prisma().session.count({ where }),
    ]);
    const page = computed ? sortComputed(found, field, sortOrder).slice(start, start + size) : found;
    res.json({
      success: true,
      data: await attachExtras(prisma(), 'session', page),
      total,
      hasMore: start + size < total,
    });
  })
);

// GET /api/sessions/export?ids=a,b,c - Excel workbook for a hand-picked set of sessions
router.get(
  '/export',
  route(null, async (req, res) => {
    const result = await sessionsWorkbook(prisma(), idsFromQuery(req.query.ids));
    if (!result) return res.status(404).json({ success: false, error: 'No session to export' });
    await sendWorkbook(res, result);
  })
);

router.get(
  '/:id',
  route(null, async (req, res) => {
    const session = await prisma().session.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: {
        track: true,
        championship: true,
        drivers: { where: { deletedAt: null }, ...withPeople, orderBy: { controller: 'asc' } },
        laps: { where: { deletedAt: null }, include: { driver: true }, orderBy: { timestamp: 'asc' } },
      },
    });
    if (!session) return notFound(res);
    res.json({ success: true, data: await attachExtras(prisma(), 'session', plainDivisions(session)) });
  })
);

// GET /api/sessions/:id/export - Excel workbook for one session
router.get(
  '/:id/export',
  route(null, async (req, res) => {
    const result = await sessionWorkbook(prisma(), req.params.id);
    if (!result) return notFound(res);
    await sendWorkbook(res, result);
  })
);

// POST /api/sessions - a standalone session (without championship)
router.post(
  '/',
  route(
    null,
    async (req, res) => {
      res.status(201).json({ success: true, data: await sessionService.createSession(req.body) });
    },
    400
  )
);

const EDITABLE = {
  name: kept,
  type: kept,
  trackId: kept,
  fuelMode: kept,
  order: kept,
  maxDuration: orNull,
  maxLaps: orNull,
  gracePeriod: orNull,
  championshipId: (id) => (id === '' ? null : id),
};

/** A track or championship that doesn't exist is a 400, not a server failure. */
function refuseBadLink(error) {
  if (error.code === 'P2003') throw new HttpError(400, 'Invalid trackId or championshipId');
  throw error;
}

router.put(
  '/:id',
  route(null, async (req, res) => {
    const session = await prisma()
      .session.update({ where: { id: req.params.id }, data: changesFrom(req.body, EDITABLE), include: SESSION_INCLUDE })
      .catch(refuseBadLink);
    res.json({ success: true, data: session });
  })
);

// DELETE /api/sessions/:id - hidden through the service first, erased when already hidden
router.delete(
  '/:id',
  route(null, async (req, res) => {
    const { id } = req.params;
    const session = await findSession(id);
    if (!session) return notFound(res);
    if (session.deletedAt) await purgeSession(prisma(), id);
    else await sessionService.deleteSession(id);
    res.json({ success: true, message: 'Session deleted' });
  })
);

// PATCH /api/sessions/:id/restore - back with what its deletion hid
router.patch(
  '/:id/restore',
  route('Failed to restore session', async (req, res) => {
    if (!(await findSession(req.params.id))) return notFound(res);
    await restoreSession(prisma(), req.params.id);
    res.json({ success: true, message: 'Session restored' });
  })
);

/**
 * The line-up rows to store: those with a driver or a car (partial rows are fine in a draft) and a
 * controller, on the grid in order unless placed. A balancing line-up belongs to `referenceId`, when set:
 * balancing measures cars, whoever holds the controller.
 */
const lineupRows = (sessionId, drivers, referenceId) =>
  drivers
    .filter((d) => (d.driverId || d.carId) && d.controller !== undefined)
    .map((d, index) => ({
      sessionId,
      driverId: referenceId ?? d.driverId ?? null,
      carId: d.carId || null,
      controller: Number(d.controller),
      gridPos: d.gridPos ?? index + 1,
    }));

// PUT /api/sessions/:id/drivers - replaces the line-up
router.put(
  '/:id/drivers',
  route(null, async (req, res) => {
    const { id } = req.params;
    const { drivers } = req.body;
    if (!Array.isArray(drivers)) return res.status(400).json({ success: false, error: 'drivers must be an array' });
    const session = await findSession(id);
    if (!session) return notFound(res);

    const reference = session.type === SessionType.BALANCING ? await getReferenceDriver(prisma()) : null;
    await prisma().sessionDriver.deleteMany({ where: { sessionId: id } });
    const rows = lineupRows(id, drivers, reference?.id);
    if (rows.length > 0) await prisma().sessionDriver.createMany({ data: rows });

    const data = await findSession(id, {
      ...SESSION_INCLUDE,
      drivers: { ...withPeople, orderBy: { controller: 'asc' } },
    });
    res.json({ success: true, data });
  })
);

// PATCH /api/sessions/:id/status - Body: { status }
router.patch(
  '/:id/status',
  route(null, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const invalid = statusError(status);
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    const session = await findSession(id);
    if (!session) return notFound(res);
    const refused = transitionError(session.status, status);
    if (refused) return res.status(400).json({ success: false, error: refused });

    await applyTransition(sessionService, id, session.status, status);
    res.json({ success: true, data: await findSession(id, SESSION_INCLUDE), message: `Status changed to '${status}'` });
  })
);

// POST /api/sessions/:id/start | pause | resume | stop
for (const [action, { from, run, refusal, message }] of Object.entries(ACTIONS)) {
  router.post(
    `/:id/${action}`,
    route(null, async (req, res) => {
      const { id } = req.params;
      const session = await findSession(id);
      if (!session) return notFound(res);
      if (!from.includes(session.status))
        return res.status(400).json({ success: false, error: refusal(session.status) });
      await run(sessionService, id);
      res.json({ success: true, data: await findSession(id, SESSION_INCLUDE), message });
    })
  );
}

// POST /api/sessions/:id/reset - back to ready: practice laps hidden (kept for stats), others erased
router.post(
  '/:id/reset',
  route(null, async (req, res) => {
    await sessionService.resetSession(req.params.id);
    res.json({ success: true, data: await findSession(req.params.id, SESSION_INCLUDE), message: 'Session reset' });
  })
);

// GET /api/sessions/:id/leaderboard - live for the running session, from the stored laps otherwise
router.get(
  '/:id/leaderboard',
  route(null, async (req, res) => {
    const { id } = req.params;
    if (sessionService.activeSessionId === id) {
      return res.json({ success: true, data: sessionService.getLeaderboard() });
    }
    const session = await findSession(id, { drivers: withPeople });
    if (!session) return notFound(res);
    res.json({ success: true, data: await storedLeaderboard(prisma(), session) });
  })
);

export default router;
