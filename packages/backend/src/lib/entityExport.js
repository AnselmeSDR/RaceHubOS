import { SessionType, toLevel } from '@racehubos/shared';
import {
  DATE_FORMAT,
  DURATION_FORMAT,
  addField,
  addFields,
  addTable,
  appVersion,
  duration,
  newSheet,
  newWorkbook,
  sheetNameOf,
  title,
} from './excel/format.js';
import { CAR_SPECS, CAR_SPEC_LABELS, SESSION_TYPE_LABELS, TAB_COLORS, carLabel } from './excel/labels.js';
import { averagePosition, emptyRecord, tallyEntry } from './excel/record.js';
import { divisionNames } from './divisions.js';

/**
 * Excel export centred on one driver or one car.
 *
 * A driver can hold a hundred sessions, so the detail of each is not what is
 * wanted here: the workbook gives the overall record, then one line per session
 * — where, when, in what, and how it ended.
 *
 * Everything is computed from the entries (`SessionDriver`), which already
 * carry each session's best lap: the laps themselves are never loaded.
 */

/** Adds an entry to `record`, its best lap included. */
function accumulate(record, entry) {
  tallyEntry(record, entry, entry.session);
  if (entry.bestLapTime && (record.bestLap == null || entry.bestLapTime < record.bestLap)) {
    record.bestLap = entry.bestLapTime;
  }
  return record;
}

/** Groups entries by something, and totals each group, most wins first. */
function groupBy(entries, keyOf, labelOf) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key == null) continue;
    if (!groups.has(key)) groups.set(key, { label: labelOf(entry), ...emptyRecord() });
    accumulate(groups.get(key), entry);
  }
  return [...groups.values()].sort((a, b) => b.wins - a.wins || b.sessions - a.sessions);
}

/** The breakdowns a record splits into: heading, grouping key, group label, column header. */
const BY_CHAMPIONSHIP = [
  'Par championnat',
  (e) => e.session.championshipId ?? 'hors-championnat',
  (e) => e.session.championship?.name ?? 'Hors championnat',
  'Championnat',
];
const BY_TRACK = ['Par circuit', (e) => e.session.trackId, (e) => e.session.track?.name ?? null, 'Circuit'];
const BY_CAR = ['Par voiture', (e) => e.carId, (e) => carLabel(e.car), 'Voiture'];
const BY_DRIVER = ['Par pilote', (e) => e.driverId, (e) => e.driver?.name ?? null, 'Pilote'];

/** The record columns shared by every breakdown table. */
const recordColumns = (label, width = 26) => [
  { header: label, value: (g) => g.label, width },
  { header: 'Sessions', value: (g) => g.sessions, width: 9 },
  { header: 'Courses', value: (g) => g.races, width: 9 },
  { header: 'Victoires', value: (g) => g.wins, width: 9 },
  { header: 'Podiums', value: (g) => g.podiums, width: 9 },
  { header: 'Abandons', value: (g) => g.dnf, width: 9 },
  { header: 'Position moyenne', value: (g) => averagePosition(g), width: 16, numFmt: '0.0' },
  { header: 'Tours', value: (g) => g.laps, width: 8 },
  { header: 'Meilleur tour', value: (g) => duration(g.bestLap), width: 13, numFmt: DURATION_FORMAT },
];

const sessionDate = (session) => new Date(session.startedAt ?? session.createdAt);

/** One line per session: where, when, in what, and how it ended. */
function addSessionList(sheet, entries, partnerHeader, partnerOf, ownerHeader = null) {
  title(sheet, `Sessions (${entries.length})`);
  const sorted = [...entries].sort((a, b) => sessionDate(b.session) - sessionDate(a.session));

  addTable(
    sheet,
    [
      ...(ownerHeader ? [{ header: ownerHeader, value: (e) => e.owner ?? null, width: 24 }] : []),
      { header: 'Date', value: (e) => sessionDate(e.session), width: 18, numFmt: DATE_FORMAT },
      { header: 'Session', value: (e) => e.session.name ?? SESSION_TYPE_LABELS[e.session.type] ?? null, width: 22 },
      { header: 'Type', value: (e) => SESSION_TYPE_LABELS[e.session.type] ?? e.session.type, width: 14 },
      { header: 'Championnat', value: (e) => e.session.championship?.name ?? null, width: 24 },
      { header: 'Circuit', value: (e) => e.session.track?.name ?? null, width: 26 },
      { header: partnerHeader, value: partnerOf, width: 26 },
      { header: 'Manette', value: (e) => e.controller + 1, width: 9 },
      { header: 'Départ', value: (e) => e.gridPos ?? null, width: 8 },
      { header: 'Arrivée', value: (e) => e.finalPos ?? null, width: 8 },
      { header: 'Tours', value: (e) => e.totalLaps, width: 8 },
      { header: 'Temps total', value: (e) => duration(e.totalTime), width: 13, numFmt: DURATION_FORMAT },
      { header: 'Meilleur tour', value: (e) => duration(e.bestLapTime), width: 13, numFmt: DURATION_FORMAT },
      { header: 'Abandon', value: (e) => (e.isDNF ? 'oui' : ''), width: 9 },
    ],
    sorted,
    { podium: (e) => (e.session.type === SessionType.RACE ? e.finalPos : null) }
  );
}

/** The overall record of `entries`, with where and when the best lap was set. */
function addRecord(sheet, entries) {
  const overall = entries.reduce(accumulate, emptyRecord());
  const bestLapEntry = entries.reduce(
    (best, e) => (e.bestLapTime && (!best || e.bestLapTime < best.bestLapTime) ? e : best),
    null
  );
  const championships = new Set(entries.map((e) => e.session.championshipId).filter(Boolean));
  const byType = (type) => entries.filter((e) => e.session.type === type).length;

  addFields(sheet, [
    ['Sessions', overall.sessions],
    ['dont essais libres', byType(SessionType.PRACTICE)],
    ['dont qualifications', byType(SessionType.QUALIF)],
    ['dont courses', overall.races],
    ['dont équilibrage', byType(SessionType.BALANCING)],
    ['Championnats', championships.size],
    ['Victoires', overall.wins],
    ['Podiums', overall.podiums],
    ['Abandons', overall.dnf],
    ['Position moyenne', averagePosition(overall), '0.0'],
    ['Tours', overall.laps],
    ['Temps en piste', duration(overall.totalTime), DURATION_FORMAT],
    ['Meilleur tour', duration(overall.bestLap), DURATION_FORMAT],
    ['signé sur', bestLapEntry?.session.track?.name ?? null],
    ['le', bestLapEntry?.session.startedAt ? new Date(bestLapEntry.session.startedAt) : null, DATE_FORMAT],
  ]);
}

/**
 * The sheet of a driver or a car (`owner`): its identity `fields`, its record, then how it breaks
 * down. Returns the entries it covers.
 */
function addOwnerSheet(workbook, taken, { name, fields, entries, breakdowns }) {
  const sheet = newSheet(workbook, sheetNameOf(name, taken), TAB_COLORS.reference);

  title(sheet, name);
  addFields(sheet, fields);
  addField(sheet, 'Exporté le', new Date(), DATE_FORMAT);
  addField(sheet, 'Version RaceHubOS', appVersion());
  sheet.addRow([]);

  title(sheet, 'Palmarès');
  addRecord(sheet, entries);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 30;
  sheet.addRow([]);

  for (const [heading, keyOf, labelOf, header] of breakdowns) {
    const groups = groupBy(entries, keyOf, labelOf);
    if (groups.length === 0) continue;
    title(sheet, heading);
    addTable(sheet, recordColumns(header), groups);
    sheet.addRow([]);
  }
}

/**
 * One sheet per owner (`sheetOf` describes it), then a single list holding every session, each
 * with its `partner` — the car a driver drove, the driver who drove a car.
 */
function buildOwnersWorkbook(owners, sheetOf, { partnerHeader, partnerOf, ownerHeader }) {
  const workbook = newWorkbook();
  const taken = new Set();
  const all = owners.flatMap((owner) => {
    const sheet = sheetOf(owner);
    const entries = (owner.sessions ?? []).filter((e) => e.session);
    addOwnerSheet(workbook, taken, { ...sheet, entries });
    return entries.map((entry) => ({ ...entry, owner: sheet.name }));
  });

  const list = newSheet(workbook, sheetNameOf('Sessions', taken), TAB_COLORS.default);
  addSessionList(list, all, partnerHeader, partnerOf, owners.length > 1 ? ownerHeader : null);
  return workbook;
}

const driverSheet = (driver) => ({
  name: driver.name,
  fields: [
    ['Numéro', driver.number ?? null],
    ['Divisions', divisionNames(driver)],
  ],
  breakdowns: [BY_CHAMPIONSHIP, BY_TRACK, BY_CAR],
});

const carSheet = (car) => ({
  name: carLabel(car),
  fields: [
    ['Année', car.year ?? null],
    ['Catégories', divisionNames(car)],
    ['Vitesse', `${toLevel(car.maxSpeed)}/10`],
    ['Freinage', `${toLevel(car.brakeForce)}/10`],
    ['Réservoir', `${toLevel(car.fuelCapacity)}/10`],
    // Ce qui est monté sur la voiture, quand c'est renseigné
    ...CAR_SPECS.map((field) => [CAR_SPEC_LABELS[field] ?? field, car[field] ?? null]),
  ],
  breakdowns: [BY_DRIVER, BY_CHAMPIONSHIP, BY_TRACK],
});

/** One sheet per driver, then a single list holding every session. */
export function buildDriversWorkbook(drivers) {
  return buildOwnersWorkbook(drivers, driverSheet, {
    partnerHeader: 'Voiture',
    partnerOf: (e) => carLabel(e.car),
    ownerHeader: 'Pilote',
  });
}

export function buildDriverWorkbook(driver) {
  return buildDriversWorkbook([driver]);
}

/** One sheet per car, then a single list holding every session. */
export function buildCarsWorkbook(cars) {
  return buildOwnersWorkbook(cars, carSheet, {
    partnerHeader: 'Pilote',
    partnerOf: (e) => e.driver?.name ?? null,
    ownerHeader: 'Voiture',
  });
}

export function buildCarWorkbook(car) {
  return buildCarsWorkbook([car]);
}
