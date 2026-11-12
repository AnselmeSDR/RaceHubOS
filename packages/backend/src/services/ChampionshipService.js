import { createPrismaClient } from '../lib/prisma.js';
import { ChampionshipMode, groupCount, SessionStatus, SessionType } from '@racehubos/shared';
import { sessionName } from '../lib/sessionNames.js';
import {
  bracketGroup,
  distributeEvenly,
  distributeSequential,
  isQualif,
  isRace,
  qualifRanking,
} from '../lib/championships/auto.js';

const now = () => new Date().toISOString();
const isFinished = (session) => session.status === SessionStatus.FINISHED;
const liveDrivers = { where: { deletedAt: null } };

/**
 * Championship sessions and auto mode: qualifying groups, race assignment from their results,
 * the bracket, and the `championship:*` events that tell the interface to refresh.
 */
export class ChampionshipService {
  constructor(io) {
    this.prisma = createPrismaClient();
    this.io = io;
    this.sessionService = null;
  }

  setSessionService(sessionService) {
    this.sessionService = sessionService;
  }

  /** A session in this championship, always on its track. */
  async createSession(championshipId, params) {
    const championship = await this.prisma.championship.findUnique({ where: { id: championshipId } });
    if (!championship) throw new Error('Championship not found');
    return this.sessionService.createSession({ ...params, championshipId, trackId: championship.trackId });
  }

  /** The championship when it is in auto mode and not deleted, else null. */
  async autoChampionship(id, include) {
    const championship = await this.prisma.championship.findUnique({ where: { id, deletedAt: null }, include });
    return championship?.mode === ChampionshipMode.AUTO ? championship : null;
  }

  /**
   * Replaces the draft qualifying and race sessions of an auto championship: qualifying groups
   * interleave the participants, never two of the same car in one; races are empty until the
   * qualifying results are in. Each driver runs the car the championship gives them.
   * @param {object} [sessionNames] - names by session type, in the interface language
   * @param {string[][]} [qualifGroups] - driver ids by qualifying, as arranged by hand (already checked)
   */
  async generateAutoSessions(championshipId, sessionNames = {}, qualifGroups = null) {
    const championship = await this.autoChampionship(championshipId, {
      participants: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
    });
    if (!championship) return;
    const { participants, driversPerQualif, driversPerRace, trackId } = championship;
    if (!participants.length || !driversPerQualif || !driversPerRace || !trackId) return;

    await this.prisma.session.deleteMany({
      where: {
        championshipId,
        type: { in: [SessionType.QUALIF, SessionType.RACE] },
        status: SessionStatus.DRAFT,
        deletedAt: null,
      },
    });

    // After the free practices, which run first (order 0 when there is just one)
    const practices = await this.prisma.session.aggregate({
      where: { championshipId, type: SessionType.PRACTICE, deletedAt: null },
      _max: { order: true },
    });
    let order = (practices._max.order ?? 0) + 1;
    const draft = (type, group, maxDuration, maxLaps, drivers = []) =>
      this.prisma.session.create({
        data: {
          name: `${sessionName(type, sessionNames)} ${group + 1}`,
          type,
          status: SessionStatus.DRAFT,
          trackId,
          championshipId,
          maxDuration,
          maxLaps,
          order: order++,
          autoGroup: group,
          drivers: {
            create: drivers.map(({ driverId, carId }, controller) => ({ driverId, carId: carId ?? null, controller })),
          },
        },
      });

    const byDriver = new Map(participants.map((p) => [p.driverId, p]));
    const groups = qualifGroups
      ? qualifGroups.map((ids) => ids.map((id) => byDriver.get(id)))
      : distributeEvenly(participants, driversPerQualif, (p) => p.carId);
    for (const [g, group] of groups.entries()) {
      await draft(SessionType.QUALIF, g, championship.qualifMaxDuration, championship.qualifMaxLaps, group);
    }
    for (let g = 0; g < groupCount(participants, driversPerRace, (p) => p.carId); g++) {
      await draft(SessionType.RACE, g, championship.raceMaxDuration, championship.raceMaxLaps);
    }
  }

  /**
   * Fills the races from the qualifying results: balanced groups, fastest first, grid in that order;
   * two drivers of the same car are split, the slower one swapped with the nearest race.
   */
  async assignDriversToRaces(championshipId) {
    const championship = await this.autoChampionship(championshipId, { participants: { where: { deletedAt: null } } });
    if (!championship) return;

    const qualifSessions = await this.prisma.session.findMany({
      where: { championshipId, type: SessionType.QUALIF, status: SessionStatus.FINISHED, deletedAt: null },
      include: { drivers: liveDrivers },
    });
    const ranking = qualifRanking(qualifSessions, championship.participants);
    const raceSessions = await this.prisma.session.findMany({
      where: { championshipId, type: SessionType.RACE, deletedAt: null },
      orderBy: { autoGroup: 'asc' },
    });
    const cars = new Map(championship.participants.map((p) => [p.driverId, p.carId]));
    const raceGroups = distributeSequential(ranking, championship.driversPerRace, (entry) => cars.get(entry.driverId));

    for (const [r, race] of raceSessions.entries()) {
      await this.prisma.sessionDriver.deleteMany({ where: { sessionId: race.id } });
      for (const [i, { driverId }] of (raceGroups[r] ?? []).entries()) {
        await this.prisma.sessionDriver.create({
          data: { sessionId: race.id, driverId, carId: cars.get(driverId) ?? null, controller: i, gridPos: i + 1 },
        });
      }
    }

    this.io?.emit('championship:races_assigned', { championshipId, timestamp: now() });
  }

  /** Qualifying and race groups of an auto championship, with the merged ranking once every qualifying is over. */
  async getBracket(championshipId) {
    const championship = await this.autoChampionship(championshipId, {
      participants: { where: { deletedAt: null }, include: { driver: true }, orderBy: { order: 'asc' } },
    });
    if (!championship) return null;

    const sessions = await this.prisma.session.findMany({
      where: { championshipId, deletedAt: null },
      include: {
        drivers: { ...liveDrivers, include: { driver: true, car: true }, orderBy: { controller: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });
    const qualifSessions = sessions.filter(isQualif);
    const allQualifsFinished = qualifSessions.length > 0 && qualifSessions.every(isFinished);
    const mergedRanking = allQualifsFinished
      ? qualifRanking(qualifSessions).map(({ bestTime, ...entry }, i) => ({
          position: i + 1,
          ...entry,
          bestTime: bestTime === Infinity ? null : bestTime,
        }))
      : [];

    return {
      mode: ChampionshipMode.AUTO,
      driversPerQualif: championship.driversPerQualif,
      driversPerRace: championship.driversPerRace,
      participants: championship.participants,
      qualifGroups: qualifSessions.map(bracketGroup('Q')),
      allQualifsFinished,
      mergedRanking,
      raceGroups: sessions.filter(isRace).map(bracketGroup('R')),
    };
  }

  // ==================== Callbacks from SessionService ====================

  emitStandingsChanged(championshipId, sessionId, reason) {
    this.io?.emit('championship:standings_changed', { championshipId, sessionId, reason, timestamp: now() });
  }

  /** The sessions of the auto championship when `sessionId` is one of its qualifyings, else null. */
  async autoSessionsAroundQualif(championshipId, sessionId) {
    const championship = await this.autoChampionship(championshipId, { sessions: { where: { deletedAt: null } } });
    const qualif = championship?.sessions.find((s) => s.id === sessionId);
    return qualif && isQualif(qualif) ? championship.sessions : null;
  }

  /** Refreshes the standings; in auto mode, the last qualifying's end assigns the races. */
  async onSessionFinished(sessionId, championshipId) {
    if (!championshipId) return;
    this.emitStandingsChanged(championshipId, sessionId, 'session_finished');

    const sessions = await this.autoSessionsAroundQualif(championshipId, sessionId);
    if (sessions?.filter(isQualif).every(isFinished)) await this.assignDriversToRaces(championshipId);
  }

  /** Refreshes the standings; in auto mode, resetting a qualifying empties the races. */
  async onStandingsChanged(championshipId, sessionId, reason) {
    if (!championshipId) return;
    this.emitStandingsChanged(championshipId, sessionId, reason);
    if (reason !== 'session_reset') return;

    const sessions = await this.autoSessionsAroundQualif(championshipId, sessionId);
    if (!sessions) return;
    const raceIds = sessions.filter(isRace).map((s) => s.id);
    await this.prisma.sessionDriver.deleteMany({ where: { sessionId: { in: raceIds } } });
    this.io?.emit('championship:races_assigned', { championshipId, cleared: true, timestamp: now() });
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

export default ChampionshipService;
