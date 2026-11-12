import {
  carTaken,
  ChampionshipMode,
  groupCount,
  MAX_SESSION_DRIVERS,
  SessionStatus,
  SessionType,
  STANDARD_SESSION_TYPES,
} from '@racehubos/shared';

const MIN_DRIVERS = 2;
const MAX_DRIVERS = 6;

/** Why `participants` can't race an automatic championship, or null: at least two distinct, existing drivers. */
export async function participantsError(prisma, participants) {
  if (!participants || participants.length < MIN_DRIVERS) return 'At least 2 participants required';
  const ids = participants.map((p) => p.driverId);
  if (new Set(ids).size !== ids.length) return 'Duplicate drivers in participants';
  const found = await prisma.driver.count({ where: { id: { in: ids }, deletedAt: null } });
  if (found !== ids.length) return 'One or more drivers not found';
  return null;
}

const groupSizeOk = (size) => size >= MIN_DRIVERS && size <= MAX_DRIVERS;

/** Why the participants' cars can't be used, or null: each one set must exist. */
async function carsError(prisma, participants) {
  const carIds = [...new Set(participants.map((p) => p.carId).filter(Boolean))];
  const found = await prisma.car.count({ where: { id: { in: carIds }, deletedAt: null } });
  return found === carIds.length ? null : 'One or more cars not found';
}

/** Each driver's car in the championship, by driver id. */
const carsByDriver = (participants) => new Map(participants.map((p) => [p.driverId, p.carId || null]));

/** The car each participant of a championship runs, by driver id, as saved. */
export async function participantCars(prisma, championshipId) {
  const rows = await prisma.championshipParticipant.findMany({
    where: { championshipId, deletedAt: null },
    select: { driverId: true, carId: true },
  });
  return new Map(rows.map((p) => [p.driverId, p.carId]));
}

/**
 * Why groups arranged by hand (`field` of the body) don't fit, or null: `count` groups of at most
 * `perGroup` drivers, none empty unless `emptyOk`, every participant once, no car twice in one.
 */
function groupsError(field, groups, { participants, count, perGroup, emptyOk = false }) {
  const carOf = (driverId) => carsByDriver(participants).get(driverId);
  const min = emptyOk ? 0 : 1;
  const valid =
    Array.isArray(groups) &&
    groups.length === count &&
    groups.every((group) => Array.isArray(group) && group.length >= min && group.length <= perGroup);
  if (!valid) return `${field} must be ${count} groups of ${min} to ${perGroup} drivers`;
  const placed = groups.flat();
  const ids = new Set(participants.map((p) => p.driverId));
  if (placed.length !== ids.size || !placed.every((id) => ids.has(id)) || new Set(placed).size !== ids.size) {
    return `${field} must hold every participant once`;
  }
  if (groups.some((group) => group.some((id) => carTaken(group, id, carOf)))) return 'Same car twice in a session';
  return null;
}

/**
 * Why the groups of an automatic championship arranged by hand don't fit, or null: the qualifying
 * groups as many as the size and the shared cars give, none empty; the free practices one group
 * each, of up to six drivers, maybe empty.
 */
function autoGroupsError({ participants, driversPerQualif, qualifGroups, practiceGroups, practiceCount = 1 }) {
  const qualifs = { participants, perGroup: driversPerQualif };
  qualifs.count = groupCount(participants, driversPerQualif, (p) => p.carId || null);
  const practices = { participants, count: practiceCount, perGroup: MAX_SESSION_DRIVERS, emptyOk: true };
  return (
    (qualifGroups !== undefined && groupsError('qualifGroups', qualifGroups, qualifs)) ||
    (practiceGroups !== undefined && groupsError('practiceGroups', practiceGroups, practices)) ||
    null
  );
}

const controllerOk = (controller) =>
  Number.isInteger(controller) && controller >= 0 && controller < MAX_SESSION_DRIVERS;

/**
 * Why the sessions of a championship planned by hand can't be created, or null: known types, at
 * most one driver per controller, participants only, once each, never the same car twice.
 */
function sessionsPlanError({ sessions, participants = [] }) {
  if (!Array.isArray(sessions)) return 'sessions must be a list';
  const cars = carsByDriver(participants);
  for (const session of sessions) {
    if (!STANDARD_SESSION_TYPES.includes(session?.type)) return 'Unknown session type';
    const drivers = session.drivers ?? [];
    if (!Array.isArray(drivers) || drivers.length > MAX_SESSION_DRIVERS) return 'Too many drivers in a session';
    if (!drivers.every((d) => cars.has(d.driverId) && controllerOk(d.controller))) {
      return 'Session drivers must be participants on controllers 0 to 5';
    }
    const unique = (key) => new Set(drivers.map((d) => d[key])).size === drivers.length;
    if (!unique('driverId') || !unique('controller')) return 'A driver or a controller twice in a session';
    const ids = drivers.map((d) => d.driverId);
    if (ids.some((id) => carTaken(ids, id, (driverId) => cars.get(driverId)))) return 'Same car twice in a session';
  }
  return null;
}

const MAX_PRACTICES = 20;
// Unset means the one free practice every championship on a track gets
const practiceCountOk = (count) =>
  count === undefined || (Number.isInteger(count) && count >= 0 && count <= MAX_PRACTICES);

/** Why a new championship can't be created as described, or null. */
export async function newChampionshipError(prisma, body) {
  const { name, season, trackId, mode, participants, driversPerQualif, driversPerRace } = body;
  if (!name || !season) return 'Name and season are required';
  if (trackId && !(await prisma.track.findUnique({ where: { id: trackId } }))) return 'Track not found';
  if (!practiceCountOk(body.practiceCount)) return `practiceCount must be between 0 and ${MAX_PRACTICES}`;
  const auto = mode === ChampionshipMode.AUTO;
  // A manual championship may have no participant: its drivers are then picked in each session
  if (auto || participants?.length) {
    const error = (await participantsError(prisma, participants)) || (await carsError(prisma, participants));
    if (error) return error;
  }
  if (!auto) {
    if (body.sessions === undefined) return null;
    if (!trackId) return 'Track is required for planned sessions';
    return sessionsPlanError(body);
  }
  if (!trackId) return 'Track is required for auto championships';
  if (!groupSizeOk(driversPerQualif)) return 'driversPerQualif must be between 2 and 6';
  if (!groupSizeOk(driversPerRace)) return 'driversPerRace must be between 2 and 6';
  return autoGroupsError(body);
}

const startedQualif = (session) => session.type === SessionType.QUALIF && session.status !== SessionStatus.DRAFT;

/** Whether one of the championship's qualifs has left the draft state. */
export const hasStartedQualif = (sessions) => sessions.some(startedQualif);

/** The drivers entered in a qualif that has started: they can no longer leave the championship. */
export async function lockedDriverIds(prisma, sessions) {
  const entries = await prisma.sessionDriver.findMany({
    where: { sessionId: { in: sessions.filter(startedQualif).map((s) => s.id) }, deletedAt: null },
    select: { driverId: true },
  });
  return new Set(entries.map((e) => e.driverId).filter(Boolean));
}

/**
 * Makes `entries` ({ driverId, carId }), in this order, the championship's participants. Those
 * dropped are hidden, not erased, so the drivers stay traceable; those kept or back are revived —
 * the unique constraint on (championshipId, driverId) means a plain create would clash with a
 * hidden row. Without `carId`, a participant keeps its car, and a newcomer takes its preferred one.
 */
export async function setParticipants(prisma, championshipId, entries) {
  const driverIds = entries.map((e) => e.driverId);
  await prisma.championshipParticipant.updateMany({
    where: { championshipId, deletedAt: null, driverId: { notIn: driverIds } },
    data: { deletedAt: new Date() },
  });
  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, preferredCarId: true },
  });
  const preferred = new Map(drivers.map((d) => [d.id, d.preferredCarId]));
  for (const [order, { driverId, carId }] of entries.entries()) {
    const given = carId !== undefined;
    await prisma.championshipParticipant.upsert({
      where: { championshipId_driverId: { championshipId, driverId } },
      create: { championshipId, driverId, order, carId: given ? carId || null : (preferred.get(driverId) ?? null) },
      update: { order, deletedAt: null, ...(given && { carId: carId || null }) },
    });
  }
}
