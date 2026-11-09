import { ChampionshipMode, SessionStatus, SessionType } from '@racehubos/shared';

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

/** Why a new championship can't be created as described, or null. */
export async function newChampionshipError(prisma, body) {
  const { name, season, trackId, mode, participants, driversPerQualif, driversPerRace } = body;
  if (!name || !season) return 'Name and season are required';
  if (trackId && !(await prisma.track.findUnique({ where: { id: trackId } }))) return 'Track not found';
  if (mode !== ChampionshipMode.AUTO) return null;
  if (!trackId) return 'Track is required for auto championships';
  const error = await participantsError(prisma, participants);
  if (error) return error;
  if (!groupSizeOk(driversPerQualif)) return 'driversPerQualif must be between 2 and 6';
  if (!groupSizeOk(driversPerRace)) return 'driversPerRace must be between 2 and 6';
  return null;
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
 * Makes `driverIds`, in this order, the championship's participants. Those dropped are hidden, not
 * erased, so the drivers stay traceable; those kept or back are revived — the unique constraint on
 * (championshipId, driverId) means a plain create would clash with a hidden row.
 */
export async function setParticipants(prisma, championshipId, driverIds) {
  await prisma.championshipParticipant.updateMany({
    where: { championshipId, deletedAt: null, driverId: { notIn: driverIds } },
    data: { deletedAt: new Date() },
  });
  for (const [order, driverId] of driverIds.entries()) {
    await prisma.championshipParticipant.upsert({
      where: { championshipId_driverId: { championshipId, driverId } },
      create: { championshipId, driverId, order },
      update: { order, deletedAt: null },
    });
  }
}
