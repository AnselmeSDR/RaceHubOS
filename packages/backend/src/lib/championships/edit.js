import {
  ChampionshipMode,
  groupCount,
  isSessionUnderway,
  MAX_SESSION_DRIVERS,
  SessionStatus,
  SessionType,
} from '@racehubos/shared';
import { purgeSession, softDeleteSession } from '../softDelete.js';
import { sessionName } from '../sessionNames.js';
import {
  carsError,
  groupsError,
  groupSizeOk,
  MAX_PRACTICES,
  participantCars,
  participantsError,
  sessionsPlanError,
  setParticipants,
} from './participants.js';
import { limitsByType } from './plan.js';

/**
 * Editing a championship under way: a session that has started never changes (grid, cars, limits,
 * place in the order); only the sessions still to come are planned again, after those that ran.
 */

const underway = (session) => isSessionUnderway(session.status);
const byOrder = (a, b) => a.order - b.order;
const carOfEntry = (p) => p.carId || null;

/** The championship's sessions that have started, and those still to come, each in running order. */
export function splitSessions(sessions) {
  const sorted = [...sessions].sort(byOrder);
  return { frozen: sorted.filter(underway), upcoming: sorted.filter((s) => !underway(s)) };
}

/** The drivers entered in a session that has started: they raced in the championship. */
export const racedDriverIds = (frozen) =>
  new Set(frozen.flatMap((s) => s.drivers.map((d) => d.driverId)).filter(Boolean));

/** The participants still to run a qualif: in none that has started. */
export function stillToQualify(participants, frozen) {
  const qualified = racedDriverIds(frozen.filter((s) => s.type === SessionType.QUALIF));
  return participants.filter((p) => !qualified.has(p.driverId));
}

/**
 * Why the automatic groups of the sessions to come don't fit, or null: the free practices one group
 * each (maybe empty), every participant at most once; the qualifs as many as the drivers still to qualify
 * need, none empty, each of those once.
 */
function upcomingGroupsError(body, frozen) {
  const { participants, driversPerQualif, practiceGroups = [], qualifGroups = [] } = body;
  if (!Array.isArray(practiceGroups) || practiceGroups.length > MAX_PRACTICES) {
    return `practiceGroups must be at most ${MAX_PRACTICES} groups`;
  }
  const practices = {
    participants,
    count: practiceGroups.length,
    perGroup: MAX_SESSION_DRIVERS,
    emptyOk: true,
    everyone: false,
  };
  const toQualify = stillToQualify(participants, frozen);
  const qualifs = {
    participants: toQualify,
    count: toQualify.length ? groupCount(toQualify, driversPerQualif, carOfEntry) : 0,
    perGroup: driversPerQualif,
  };
  return (
    (practiceGroups.length > 0 && groupsError('practiceGroups', practiceGroups, practices)) ||
    (qualifs.count > 0 || qualifGroups.length > 0 ? groupsError('qualifGroups', qualifGroups, qualifs) : null)
  );
}

/** Why the sessions to come planned by hand can't be saved, or null: an `id` names one of them, once. */
function upcomingPlanError(body, upcoming) {
  const error = sessionsPlanError(body);
  if (error) return error;
  const ids = body.sessions.map((s) => s.id).filter(Boolean);
  const known = new Set(upcoming.map((s) => s.id));
  if (new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    return 'A session to come is named twice or is not one of the championship’s';
  }
  const kept = new Map(upcoming.map((s) => [s.id, s.type]));
  if (body.sessions.some((s) => s.id && kept.get(s.id) !== s.type)) return 'A session keeps its type';
  return null;
}

/** Why the edit can't be applied to `championship` (with its sessions and their entries), or null. */
export async function editError(prisma, championship, body) {
  const { name, trackId, mode, participants = [] } = body;
  if (!name?.trim()) return 'Name is required';
  if (!Object.values(ChampionshipMode).includes(mode)) return 'Unknown mode';
  const { frozen, upcoming } = splitSessions(championship.sessions);
  if (trackId !== undefined && trackId !== championship.trackId) {
    if (frozen.length) return 'The track no longer changes once a session has run';
    if (!trackId || !(await prisma.track.findUnique({ where: { id: trackId } }))) return 'Track not found';
  }
  const auto = mode === ChampionshipMode.AUTO;
  if (auto || participants.length) {
    const error = (await participantsError(prisma, participants)) || (await carsError(prisma, participants));
    if (error) return error;
  }
  if (!auto) return upcomingPlanError({ ...body, sessions: body.sessions ?? [] }, upcoming);
  if (!groupSizeOk(body.driversPerQualif)) return 'driversPerQualif must be between 2 and 6';
  if (!groupSizeOk(body.driversPerRace)) return 'driversPerRace must be between 2 and 6';
  return upcomingGroupsError(body, frozen);
}

const entriesOf = (ids = []) => ids.map((driverId, controller) => ({ driverId, controller }));

/**
 * The sessions to come of an automatic championship: free practices and qualifs as grouped, then
 * the races still to run, empty until the qualifying results are in.
 */
function autoPlan(body, frozen) {
  const ofType = (type) => frozen.filter((s) => s.type === type).length;
  const races = groupCount(body.participants, body.driversPerRace, carOfEntry) - ofType(SessionType.RACE);
  return [
    ...(body.practiceGroups ?? []).map((ids) => ({ type: SessionType.PRACTICE, drivers: entriesOf(ids) })),
    ...(body.qualifGroups ?? []).map((ids, g) => ({
      type: SessionType.QUALIF,
      autoGroup: ofType(SessionType.QUALIF) + g,
      drivers: entriesOf(ids),
    })),
    ...Array.from({ length: Math.max(0, races) }, (_, r) => ({
      type: SessionType.RACE,
      autoGroup: ofType(SessionType.RACE) + r,
      drivers: [],
    })),
  ];
}

/**
 * Each session of the plan with the session to come it reuses: the one named by its `id`, or in
 * automatic mode the next one of its type.
 */
function matchUpcoming(plan, upcoming, auto) {
  if (!auto) return plan.map((item) => ({ item, session: upcoming.find((s) => s.id === item.id) }));
  const left = [...upcoming];
  return plan.map((item) => {
    const index = left.findIndex((s) => s.type === item.type);
    return { item, session: index >= 0 ? left.splice(index, 1)[0] : undefined };
  });
}

/**
 * The participants who leave after racing: DNF in each session to come they were entered in, which
 * keeps them out of it. Those back in the championship are taken off the sessions to come.
 */
async function recordWithdrawals(prisma, championship, participants, frozen, upcoming) {
  const staying = new Set(participants.map((p) => p.driverId));
  const raced = racedDriverIds(frozen);
  const leaving = championship.participants.filter((p) => !staying.has(p.driverId) && raced.has(p.driverId));
  for (const { driverId, carId } of leaving) {
    for (const session of upcoming) {
      const entry = session.drivers.find((d) => d.driverId === driverId);
      if (!entry) continue;
      await prisma.sessionWithdrawal.upsert({
        where: { sessionId_driverId: { sessionId: session.id, driverId } },
        create: { sessionId: session.id, driverId, carId: entry.carId ?? carId ?? null },
        update: {},
      });
    }
  }
  await prisma.sessionWithdrawal.deleteMany({
    where: { driverId: { in: [...staying] }, sessionId: { in: upcoming.map((s) => s.id) } },
  });
}

/** Removes a session to come: to the bin when it holds laps (a reset kept them), else for good. */
async function dropSession(prisma, session) {
  const laps = await prisma.lap.count({ where: { sessionId: session.id } });
  if (laps) await softDeleteSession(prisma, session.id);
  else await purgeSession(prisma, session.id);
}

/**
 * Plans the sessions to come again: each in its place after the sessions that ran, with its
 * drivers on their controllers and their championship car, the limits of its type. A new session
 * is numbered among all of its type; one left out is removed.
 */
async function replanUpcoming(prisma, { championship, plan, frozen, upcoming, auto, trackId, body }) {
  const cars = await participantCars(prisma, championship.id);
  const limits = limitsByType(body);
  const firstOrder = Math.max(-1, ...frozen.map((s) => s.order)) + 1;
  const matched = matchUpcoming(plan, upcoming, auto);
  const kept = new Set(matched.map((m) => m.session?.id).filter(Boolean));
  for (const session of upcoming.filter((s) => !kept.has(s.id))) await dropSession(prisma, session);

  const total = (type) => frozen.filter((s) => s.type === type).length + plan.filter((s) => s.type === type).length;
  const seen = {};
  for (const type of Object.values(SessionType)) seen[type] = frozen.filter((s) => s.type === type).length;

  for (const [index, { item, session }] of matched.entries()) {
    seen[item.type] += 1;
    const drivers = (item.drivers ?? []).map(({ driverId, controller }) => ({
      driverId,
      controller,
      carId: cars.get(driverId) ?? null,
    }));
    const data = { order: firstOrder + index, trackId, ...limits[item.type], autoGroup: item.autoGroup ?? null };
    if (session) {
      await prisma.sessionDriver.deleteMany({ where: { sessionId: session.id } });
      await prisma.session.update({ where: { id: session.id }, data: { ...data, drivers: { create: drivers } } });
      continue;
    }
    const name = sessionName(item.type, body.sessionNames);
    const numbered = item.type !== SessionType.PRACTICE || total(item.type) > 1;
    await prisma.session.create({
      data: {
        ...data,
        name: numbered ? `${name} ${seen[item.type]}` : name,
        type: item.type,
        championshipId: championship.id,
        drivers: { create: drivers },
      },
    });
  }
}

/**
 * Applies the edit (checked by `editError`) to `championship`, with its participants and its
 * sessions and their entries: name, track while no session ran, mode, limits, line-up (a driver who
 * raced and leaves is DNF in the sessions to come they were in), and the sessions to come.
 * Returns whether the races of an automatic championship are to be filled again.
 */
export async function applyEdit(prisma, championship, body) {
  const { frozen, upcoming } = splitSessions(championship.sessions);
  const auto = body.mode === ChampionshipMode.AUTO;
  const trackId = frozen.length ? championship.trackId : (body.trackId ?? championship.trackId);
  const participants = body.participants ?? [];

  await prisma.championship.update({
    where: { id: championship.id },
    data: {
      name: body.name.trim(),
      trackId,
      mode: body.mode,
      driversPerQualif: auto ? body.driversPerQualif : null,
      driversPerRace: auto ? body.driversPerRace : null,
      qualifMaxDuration: body.qualifMaxDuration || null,
      qualifMaxLaps: body.qualifMaxLaps || null,
      raceMaxDuration: body.raceMaxDuration || null,
      raceMaxLaps: body.raceMaxLaps || null,
    },
  });
  await recordWithdrawals(prisma, championship, participants, frozen, upcoming);
  await setParticipants(prisma, championship.id, participants);
  const plan = auto ? autoPlan(body, frozen) : body.sessions;
  await replanUpcoming(prisma, { championship, plan, frozen, upcoming, auto, trackId, body });

  // Every qualif finished and none to come: the races to come are filled from the ranking
  const qualifs = frozen.filter((s) => s.type === SessionType.QUALIF);
  return (
    auto &&
    !plan.some((s) => s.type === SessionType.QUALIF) &&
    qualifs.length > 0 &&
    qualifs.every((s) => s.status === SessionStatus.FINISHED)
  );
}
