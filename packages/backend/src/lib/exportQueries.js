import {
  buildChampionshipWorkbook,
  buildChampionshipsWorkbook,
  buildSessionWorkbook,
  buildSessionsWorkbook,
  exportFileName,
} from './excelExport.js';
import { buildCarsWorkbook, buildDriversWorkbook } from './entityExport.js';

/** Everything a session sheet needs, in one query. */
const sessionInclude = {
  track: true,
  championship: true,
  drivers: {
    where: { deletedAt: null },
    include: { driver: { include: { team: true } }, car: true },
    orderBy: { controller: 'asc' },
  },
  laps: {
    where: { deletedAt: null },
    include: { driver: { include: { team: true } }, car: true },
    orderBy: { lapNumber: 'asc' },
  },
};

export async function sessionWorkbook(prisma, id) {
  const session = await prisma.session.findUnique({
    where: { id, deletedAt: null },
    include: sessionInclude,
  });
  if (!session) return null;

  const label = session.name || session.track?.name || 'session';
  return { workbook: buildSessionWorkbook(session), fileName: exportFileName(label) };
}

export async function championshipWorkbook(prisma, id) {
  const championship = await prisma.championship.findUnique({
    where: { id, deletedAt: null },
    include: championshipInclude,
  });
  if (!championship) return null;

  return {
    workbook: buildChampionshipWorkbook(championship),
    fileName: exportFileName(championship.name),
  };
}

const championshipInclude = {
  track: true,
  participants: { where: { deletedAt: null }, include: { driver: true } },
  sessions: { where: { deletedAt: null }, include: sessionInclude, orderBy: { order: 'asc' } },
};

/** Ids from a comma-separated query parameter, deduplicated. */
export function idsFromQuery(raw) {
  return [...new Set(String(raw ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
}

/** One workbook for a hand-picked set of sessions. */
export async function sessionsWorkbook(prisma, ids) {
  if (ids.length === 0) return null;

  const sessions = await prisma.session.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: sessionInclude,
    orderBy: [{ createdAt: 'asc' }, { order: 'asc' }],
  });
  if (sessions.length === 0) return null;

  const label = sessions.length === 1 ? (sessions[0].name ?? 'session') : `${sessions.length}-sessions`;
  return { workbook: buildSessionsWorkbook(sessions), fileName: exportFileName(label) };
}

/** One workbook for a hand-picked set of championships. */
export async function championshipsWorkbook(prisma, ids) {
  if (ids.length === 0) return null;

  const championships = await prisma.championship.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: championshipInclude,
    orderBy: { createdAt: 'asc' },
  });
  if (championships.length === 0) return null;

  const label = championships.length === 1 ? championships[0].name : `${championships.length}-championnats`;
  return { workbook: buildChampionshipsWorkbook(championships), fileName: exportFileName(label) };
}

/**
 * A driver or a car can hold a hundred sessions, so the laps are never loaded:
 * each entry already carries its own best lap and total time.
 */
const entryInclude = {
  where: { deletedAt: null },
  include: {
    car: true,
    driver: { include: { team: true } },
    session: { include: { track: true, championship: true } },
  },
};

export async function driversWorkbook(prisma, ids) {
  if (ids.length === 0) return null;

  const drivers = await prisma.driver.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: { team: true, sessions: entryInclude },
    orderBy: { name: 'asc' },
  });
  if (drivers.length === 0) return null;

  const label = drivers.length === 1 ? drivers[0].name : `${drivers.length}-pilotes`;
  return { workbook: buildDriversWorkbook(drivers), fileName: exportFileName(label) };
}

export async function carsWorkbook(prisma, ids) {
  if (ids.length === 0) return null;

  const cars = await prisma.car.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: { sessions: entryInclude },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }],
  });
  if (cars.length === 0) return null;

  const label = cars.length === 1 ? `${cars[0].brand} ${cars[0].model}` : `${cars.length}-voitures`;
  return { workbook: buildCarsWorkbook(cars), fileName: exportFileName(label) };
}

export const driverWorkbook = (prisma, id) => driversWorkbook(prisma, [id]);
export const carWorkbook = (prisma, id) => carsWorkbook(prisma, [id]);

/** Streams a workbook as an .xlsx download. */
export async function sendWorkbook(res, { workbook, fileName }) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(res);
  res.end();
}
