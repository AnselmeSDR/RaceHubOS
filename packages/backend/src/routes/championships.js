import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { attachExtras } from '../addons/extras.js';
import { ChampionshipMode, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared';
import { championshipWorkbook, championshipsWorkbook, idsFromQuery, sendWorkbook } from '../lib/exportQueries.js';
import { sessionName } from '../lib/sessionNames.js';
import { purgeChampionship, restoreChampionship, softDeleteChampionship } from '../lib/softDelete.js';
import { DETAIL_INCLUDE, LIST_INCLUDE, SAVED_INCLUDE } from '../lib/championships/includes.js';
import { isComputedSort, listWhere, sortComputed } from '../lib/championships/list.js';
import {
  hasStartedQualif,
  lockedDriverIds,
  newChampionshipError,
  participantsError,
  setParticipants,
} from '../lib/championships/participants.js';
import { championshipResults } from '../lib/championships/results.js';
import { championshipStandings, standingsInclude, STANDINGS_TYPES } from '../lib/championships/standings.js';
import { route } from '../lib/http.js';

const router = express.Router();
const prisma = createPrismaClient();

let championshipService;

export function setChampionshipService(service) {
  championshipService = service;
}

const notFound = (res) => res.status(404).json({ success: false, error: 'Championship not found' });

// GET /api/championships - list, filtered (deleted, trackId, status), sorted and paginated
router.get(
  '/',
  route('Failed to fetch championships', async (req, res) => {
    const { limit = '50', offset = '0', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const where = listWhere(req.query);
    const computed = isComputedSort(sortBy);

    const [all, total] = await Promise.all([
      prisma.championship.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: computed ? undefined : { [sortBy]: sortOrder },
      }),
      prisma.championship.count({ where }),
    ]);

    const start = parseInt(offset);
    const end = start + parseInt(limit);
    const page = (computed ? sortComputed(all, sortBy, sortOrder) : all).slice(start, end);
    res.json({ success: true, data: await attachExtras(prisma, 'championship', page), total, hasMore: end < total });
  })
);

// GET /api/championships/export?ids=a,b,c - Excel workbook for a hand-picked set of championships
router.get(
  '/export',
  route(null, async (req, res) => {
    const result = await championshipsWorkbook(prisma, idsFromQuery(req.query.ids));
    if (!result) return res.status(404).json({ success: false, error: 'No championship to export' });
    await sendWorkbook(res, result);
  })
);

// GET /api/championships/:id/export - Excel workbook for a championship and all its sessions
router.get(
  '/:id/export',
  route(null, async (req, res) => {
    const result = await championshipWorkbook(prisma, req.params.id);
    if (!result) return notFound(res);
    await sendWorkbook(res, result);
  })
);

router.get(
  '/:id',
  route('Failed to fetch championship', async (req, res) => {
    const championship = await prisma.championship.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!championship) return notFound(res);
    res.json({ success: true, data: await attachExtras(prisma, 'championship', championship) });
  })
);

// POST /api/championships - a manual or automatic championship, with its practice and generated sessions
router.post(
  '/',
  route('Failed to create championship', async (req, res) => {
    const error = await newChampionshipError(prisma, req.body);
    if (error) return res.status(400).json({ success: false, error });

    const { name, season, status, trackId, mode, participants, sessionNames } = req.body;
    const auto = mode === ChampionshipMode.AUTO;
    const { driversPerQualif, driversPerRace, qualifMaxDuration, qualifMaxLaps, raceMaxDuration, raceMaxLaps } =
      req.body;

    const championship = await prisma.championship.create({
      data: {
        name: name.trim(),
        season: season.trim(),
        status: status || ChampionshipStatus.PLANNED,
        trackId: trackId || null,
        mode: mode || ChampionshipMode.MANUAL,
        driversPerQualif: auto ? driversPerQualif : null,
        driversPerRace: auto ? driversPerRace : null,
        qualifMaxDuration: qualifMaxDuration || null,
        qualifMaxLaps: qualifMaxLaps || null,
        raceMaxDuration: raceMaxDuration || null,
        raceMaxLaps: raceMaxLaps || null,
      },
    });

    if (auto) {
      await setParticipants(
        prisma,
        championship.id,
        participants.map((p) => p.driverId)
      );
    }
    // Every championship on a track keeps a free practice session
    if (trackId) {
      await prisma.session.create({
        data: {
          name: sessionName(SessionType.PRACTICE, sessionNames),
          type: SessionType.PRACTICE,
          status: SessionStatus.DRAFT,
          championshipId: championship.id,
          trackId,
        },
      });
    }
    if (auto) await championshipService.generateAutoSessions(championship.id, sessionNames);

    const result = await prisma.championship.findUnique({
      where: { id: championship.id },
      include: { track: true, ...SAVED_INCLUDE },
    });
    res.status(201).json({ success: true, data: result });
  })
);

// PUT /api/championships/:id - name, season and status
router.put(
  '/:id',
  route('Failed to update championship', async (req, res) => {
    const { id } = req.params;
    const { name, season, status } = req.body;
    if (!(await prisma.championship.findUnique({ where: { id } }))) return notFound(res);

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (season !== undefined) data.season = season.trim();
    if (status !== undefined) data.status = status;

    const championship = await prisma.championship.update({ where: { id }, data, include: { sessions: true } });
    res.json({ success: true, data: championship });
  })
);

// DELETE /api/championships/:id - hidden with everything recorded in it; erased when already hidden
router.delete(
  '/:id',
  route('Failed to delete championship', async (req, res) => {
    const { id } = req.params;
    const championship = await prisma.championship.findUnique({ where: { id } });
    if (!championship) return notFound(res);

    if (championship.deletedAt) await purgeChampionship(prisma, id);
    else await softDeleteChampionship(prisma, id);
    res.json({ success: true, message: 'Championship deleted successfully' });
  })
);

// PATCH /api/championships/:id/restore - back with only what its deletion hid
router.patch(
  '/:id/restore',
  route('Failed to restore championship', async (req, res) => {
    if (!(await prisma.championship.findUnique({ where: { id: req.params.id } }))) return notFound(res);
    await restoreChampionship(prisma, req.params.id);
    res.json({ success: true, message: 'Championship restored' });
  })
);

// POST /api/championships/:id/sessions - Body: { type, name, duration, maxLaps, order, gridFromQualifying }
router.post(
  '/:id/sessions',
  route(
    null,
    async (req, res) => {
      const { id } = req.params;
      if (!(await prisma.championship.findUnique({ where: { id } }))) return notFound(res);
      res.json({ success: true, data: await championshipService.createSession(id, req.body) });
    },
    400
  )
);

// GET /api/championships/:id/results - podium, race standings and awards
router.get(
  '/:id/results',
  route('Failed to fetch results', async (req, res) => {
    const withPeople = { where: { deletedAt: null }, include: { driver: true, car: true } };
    const championship = await prisma.championship.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { sessions: { where: { deletedAt: null }, include: { drivers: withPeople, laps: withPeople } } },
    });
    if (!championship) return notFound(res);
    res.json({ success: true, data: championshipResults(championship.sessions) });
  })
);

// GET /api/championships/:id/bracket - an automatic championship's groups and merged ranking
router.get(
  '/:id/bracket',
  route('Failed to fetch bracket', async (req, res) => {
    const bracket = await championshipService.getBracket(req.params.id);
    if (!bracket) {
      return res.status(404).json({ success: false, error: 'Championship not found or not in auto mode' });
    }
    res.json({ success: true, data: bracket });
  })
);

// PUT /api/championships/:id/participants - an automatic championship's drivers, in order
router.put(
  '/:id/participants',
  route('Failed to update participants', async (req, res) => {
    const { id } = req.params;
    const { participants, sessionNames } = req.body;
    const bad = (error) => res.status(400).json({ success: false, error });

    const championship = await prisma.championship.findUnique({
      where: { id, deletedAt: null },
      include: { sessions: { where: { deletedAt: null } } },
    });
    if (!championship) return notFound(res);
    if (championship.mode !== ChampionshipMode.AUTO) return bad('Only auto championships support participants');
    const error = await participantsError(prisma, participants);
    if (error) return bad(error);

    const driverIds = participants.map((p) => p.driverId);
    const started = hasStartedQualif(championship.sessions);
    if (started) {
      const locked = await lockedDriverIds(prisma, championship.sessions);
      if ([...locked].some((driverId) => !driverIds.includes(driverId))) {
        return bad('Cannot remove driver who already participated in a qualif');
      }
    }

    await setParticipants(prisma, id, driverIds);
    // Before any qualif the sessions are regenerated; afterwards a newcomer needs a qualif added by hand
    if (!started) await championshipService.generateAutoSessions(id, sessionNames);

    res.json({ success: true, data: await prisma.championship.findUnique({ where: { id }, include: SAVED_INCLUDE }) });
  })
);

// GET /api/championships/:id/standings?type=qualif|race|practice
router.get(
  '/:id/standings',
  route('Failed to fetch standings', async (req, res) => {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type parameter is required. Must be one of: qualif, race, practice',
      });
    }
    if (!STANDINGS_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type. Must be one of: qualif, race, practice' });
    }

    const championship = await prisma.championship.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: standingsInclude(type),
    });
    if (!championship) return notFound(res);

    const standings = championshipStandings(type, championship.sessions);
    res.json({ success: true, type, standings, count: standings.length });
  })
);

export default router;
