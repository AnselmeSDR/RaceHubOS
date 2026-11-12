import { DivisionScope, NO_DIVISION } from '@racehubos/shared';
import { HttpError } from './http.js';
import { addImageUrl, withImageUrl } from '../utils/imageUrl.js';
import { FIGURES_INCLUDE, withFigures } from './stats/figures.js';

/** The link table of each record type, and the divisions it may join (null: both scopes). */
const LINKS = {
  driver: { model: 'driverDivision', key: 'driverId', scope: DivisionScope.DRIVER },
  car: { model: 'carDivision', key: 'carId', scope: DivisionScope.CAR },
  championship: { model: 'championshipDivision', key: 'championshipId', scope: null },
};

/** A record's divisions, from the highest rank, without the ones in the bin. */
export const DIVISIONS_INCLUDE = {
  where: { division: { deletedAt: null } },
  orderBy: [{ division: { order: 'asc' } }, { division: { name: 'asc' } }],
  include: { division: true },
};

/** A session entry's driver and car, each with its divisions. */
export const PEOPLE_INCLUDE = {
  driver: { include: { divisions: DIVISIONS_INCLUDE } },
  car: { include: { divisions: DIVISIONS_INCLUDE } },
};

/** A record's divisions, read with `DIVISIONS_INCLUDE` or already plain. */
export const divisionsOf = (record) => (record?.divisions ?? []).map((link) => link.division ?? link);

/** Its divisions' names for a sheet, blank without one. */
export const divisionNames = (record) =>
  divisionsOf(record)
    .map((division) => division.name)
    .join(', ') || null;

/** The divisions of a record read with `DIVISIONS_INCLUDE`, as plain divisions. */
export function withDivisions(record) {
  if (!record?.divisions) return record;
  return { ...record, divisions: divisionsOf(record).map((d) => ({ ...d, img: addImageUrl(d.img) })) };
}

/** `value` with every `divisions` list read with `DIVISIONS_INCLUDE` made plain, at any depth. */
export function plainDivisions(value) {
  if (Array.isArray(value)) return value.map(plainDivisions);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === 'divisions' && Array.isArray(item) ? withDivisions({ divisions: item }).divisions : plainDivisions(item),
    ])
  );
}

/** A member with its divisions and what its figures are read from. */
const memberInclude = { include: { divisions: DIVISIONS_INCLUDE, ...FIGURES_INCLUDE } };

/** A division's page: its drivers and cars (with their divisions) and the championships run for it. */
export const DIVISION_DETAIL = {
  drivers: {
    where: { driver: { deletedAt: null } },
    include: { driver: memberInclude },
    orderBy: { driver: { name: 'asc' } },
  },
  cars: {
    where: { car: { deletedAt: null } },
    include: { car: memberInclude },
    orderBy: [{ car: { brand: 'asc' } }, { car: { model: 'asc' } }],
  },
  championships: {
    where: { championship: { deletedAt: null } },
    include: { championship: { include: { track: true, divisions: DIVISIONS_INCLUDE } } },
    orderBy: { championship: { createdAt: 'desc' } },
  },
};

/** A division read with `DIVISION_DETAIL`, flat: each member with its figures and the date it joined (`since`). */
export function divisionDetail(division) {
  const { drivers = [], cars = [], championships = [], ...rest } = division;
  const member = (record, link) => ({ ...withImageUrl(withDivisions(withFigures(record))), since: link.createdAt });
  return {
    ...withImageUrl(rest),
    drivers: drivers.map((link) => member(link.driver, link)),
    cars: cars.map((link) => member(link.car, link)),
    championships: championships.map((link) => plainDivisions(link.championship)),
  };
}

const rankOf = (record) => record.divisions?.[0]?.division ?? record.divisions?.[0];

/** Ascending rank of the first division, then its name; records in no division last. */
export function byDivision(a, b) {
  const first = rankOf(a);
  const second = rankOf(b);
  if (!first || !second) return (first ? 0 : 1) - (second ? 0 : 1);
  return first.order - second.order || first.name.localeCompare(second.name);
}

/**
 * The `where` for a `divisionId` filter: `a,b` keeps the records in at least one of them,
 * `none` the records in no division (the ones in the bin don't count), both can mix.
 */
export function divisionWhere(divisionId) {
  if (!divisionId) return {};
  const requested = String(divisionId).split(',').filter(Boolean);
  const ids = requested.filter((id) => id !== NO_DIVISION);
  const clauses = [];
  if (ids.length) clauses.push({ divisions: { some: { divisionId: { in: ids } } } });
  if (requested.includes(NO_DIVISION)) clauses.push({ divisions: { none: { division: { deletedAt: null } } } });
  if (clauses.length === 0) return {};
  return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

/** `divisionIds` as sent: an array of ids, undefined when absent (nothing changes). */
function idsFrom(divisionIds) {
  if (divisionIds === undefined) return undefined;
  if (!Array.isArray(divisionIds) || divisionIds.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, 'divisionIds must be an array of ids');
  }
  return [...new Set(divisionIds)];
}

/** Refuses an unknown division, one in the bin, or one of another scope than the record's. */
export async function checkDivisions(prisma, type, divisionIds) {
  const ids = idsFrom(divisionIds);
  if (!ids?.length) return ids;
  const { scope } = LINKS[type];
  const found = await prisma.division.findMany({ where: { id: { in: ids }, deletedAt: null } });
  if (found.length !== ids.length) throw new HttpError(400, 'Division not found');
  if (scope && found.some((division) => division.scope !== scope)) {
    throw new HttpError(400, `Only ${scope} divisions can be given`);
  }
  return ids;
}

/**
 * Puts record `id` of `type` in exactly the divisions `ids` (checked first): the links kept keep
 * their date, the ones to divisions in the bin stay for a restore. Undefined `ids` changes nothing.
 */
export async function setDivisions(tx, type, id, ids) {
  if (ids === undefined) return;
  const { model, key } = LINKS[type];
  await tx[model].deleteMany({ where: { [key]: id, divisionId: { notIn: ids }, division: { deletedAt: null } } });
  const kept = await tx[model].findMany({ where: { [key]: id, divisionId: { in: ids } } });
  const added = ids.filter((divisionId) => !kept.some((link) => link.divisionId === divisionId));
  if (added.length) await tx[model].createMany({ data: added.map((divisionId) => ({ [key]: id, divisionId })) });
}
