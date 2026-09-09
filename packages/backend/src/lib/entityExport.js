import ExcelJS from 'exceljs';
import { CAR_NUMBER_SPECS, CAR_TEXT_SPECS, SessionType, toLevel } from '@racehubos/shared';
import {
  DATE_FORMAT,
  DURATION_FORMAT,
  SESSION_TYPE_LABELS,
  TAB_COLORS,
  addField,
  addTable,
  appVersion,
  duration,
  newSheet,
  sheetNameOf,
  title,
  CAR_SPEC_LABELS,
} from './excelExport.js';

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

const EMPTY = { sessions: 0, races: 0, wins: 0, podiums: 0, dnf: 0, laps: 0, totalTime: 0, bestLap: null, positions: [] };

function accumulate(target, entry, session) {
  target.sessions += 1;
  target.laps += entry.totalLaps ?? 0;
  target.totalTime += entry.totalTime ?? 0;
  if (entry.isDNF) target.dnf += 1;
  if (entry.bestLapTime && (target.bestLap == null || entry.bestLapTime < target.bestLap)) {
    target.bestLap = entry.bestLapTime;
  }
  if (session.type === SessionType.RACE) {
    target.races += 1;
    if (entry.finalPos != null) target.positions.push(entry.finalPos);
    if (entry.finalPos === 1) target.wins += 1;
    if (entry.finalPos != null && entry.finalPos <= 3) target.podiums += 1;
  }
  return target;
}

/** Groups entries by something, and totals each group. */
function groupBy(entries, keyOf, labelOf) {
  const groups = new Map();

  for (const entry of entries) {
    const key = keyOf(entry);
    if (key == null) continue;

    if (!groups.has(key)) {
      groups.set(key, { label: labelOf(entry), ...structuredClone(EMPTY) });
    }
    accumulate(groups.get(key), entry, entry.session);
  }
  return [...groups.values()].sort((a, b) => b.wins - a.wins || b.sessions - a.sessions);
}

const averagePosition = (s) => (s.positions.length ? s.positions.reduce((a, b) => a + b, 0) / s.positions.length : null);

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

/** One line per session: where, when, in what, and how it ended. */
function addSessionList(sheet, entries, partnerHeader, partnerOf, ownerHeader = null) {
  title(sheet, `Sessions (${entries.length})`);

  const sorted = [...entries].sort((a, b) => {
    const left = a.session.startedAt ?? a.session.createdAt;
    const right = b.session.startedAt ?? b.session.createdAt;
    return new Date(right) - new Date(left);
  });

  addTable(sheet, [
    ...(ownerHeader ? [{ header: ownerHeader, value: (e) => e.owner ?? null, width: 24 }] : []),
    { header: 'Date', value: (e) => (e.session.startedAt ? new Date(e.session.startedAt) : new Date(e.session.createdAt)), width: 18, numFmt: DATE_FORMAT },
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
  ], sorted, { podium: (e) => (e.session.type === SessionType.RACE ? e.finalPos : null) });
}

function addRecord(sheet, entries) {
  const overall = entries.reduce((acc, e) => accumulate(acc, e, e.session), structuredClone(EMPTY));
  const bestLapEntry = entries.reduce(
    (best, e) => (e.bestLapTime && (!best || e.bestLapTime < best.bestLapTime) ? e : best),
    null,
  );

  const championships = new Set(entries.map((e) => e.session.championshipId).filter(Boolean));
  const byType = (type) => entries.filter((e) => e.session.type === type).length;

  for (const [label, value, numFmt] of [
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
  ]) {
    addField(sheet, label, value, numFmt);
  }
  return overall;
}

const carLabel = (car) => (car ? `${car.brand} ${car.model}` : null);

/** A driver's own sheet: identity, record, then how it breaks down. */
function addDriverSheet(workbook, driver, taken) {
  const entries = (driver.sessions ?? []).filter((e) => e.session);
  const sheet = newSheet(workbook, sheetNameOf(driver.name, taken), TAB_COLORS.reference);

  title(sheet, driver.name);
  addField(sheet, 'Numéro', driver.number ?? null);
  addField(sheet, 'Équipe', driver.team?.name ?? null);
  addField(sheet, 'Exporté le', new Date(), DATE_FORMAT);
  addField(sheet, 'Version RaceHubOS', appVersion());
  sheet.addRow([]);

  title(sheet, 'Palmarès');
  addRecord(sheet, entries);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 30;
  sheet.addRow([]);

  const breakdowns = [
    ['Par championnat', groupBy(entries, (e) => e.session.championshipId ?? 'hors-championnat',
      (e) => e.session.championship?.name ?? 'Hors championnat'), 'Championnat'],
    ['Par circuit', groupBy(entries, (e) => e.session.trackId, (e) => e.session.track?.name ?? null), 'Circuit'],
    ['Par voiture', groupBy(entries, (e) => e.carId, (e) => carLabel(e.car)), 'Voiture'],
  ];
  for (const [heading, groups, label] of breakdowns) {
    if (groups.length === 0) continue;
    title(sheet, heading);
    addTable(sheet, recordColumns(label), groups);
    sheet.addRow([]);
  }

  return entries;
}

export function buildDriverWorkbook(driver) {
  return buildDriversWorkbook([driver]);
}

/** One sheet per driver, then a single list holding every session. */
export function buildDriversWorkbook(drivers) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `RaceHubOS ${appVersion()}`;
  workbook.created = new Date();

  const taken = new Set();
  const all = drivers.flatMap((driver) =>
    addDriverSheet(workbook, driver, taken).map((entry) => ({ ...entry, owner: driver.name })));

  const list = newSheet(workbook, sheetNameOf('Sessions', taken), TAB_COLORS.default);
  addSessionList(list, all, 'Voiture', (e) => carLabel(e.car), drivers.length > 1 ? 'Pilote' : null);

  return workbook;
}

function addCarSheet(workbook, car, taken) {
  const entries = (car.sessions ?? []).filter((e) => e.session);
  const label = carLabel(car);
  const sheet = newSheet(workbook, sheetNameOf(label, taken), TAB_COLORS.reference);

  title(sheet, label);
  addField(sheet, 'Année', car.year ?? null);
  addField(sheet, 'Vitesse', `${toLevel(car.maxSpeed)}/10`);
  addField(sheet, 'Freinage', `${toLevel(car.brakeForce)}/10`);
  addField(sheet, 'Réservoir', `${toLevel(car.fuelCapacity)}/10`);
  // Ce qui est monté sur la voiture, quand c'est renseigné
  for (const field of [...CAR_TEXT_SPECS, ...CAR_NUMBER_SPECS]) {
    addField(sheet, CAR_SPEC_LABELS[field] ?? field, car[field] ?? null);
  }
  addField(sheet, 'Exporté le', new Date(), DATE_FORMAT);
  addField(sheet, 'Version RaceHubOS', appVersion());
  sheet.addRow([]);

  title(sheet, 'Palmarès');
  addRecord(sheet, entries);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 30;
  sheet.addRow([]);

  const breakdowns = [
    ['Par pilote', groupBy(entries, (e) => e.driverId, (e) => e.driver?.name ?? null), 'Pilote'],
    ['Par championnat', groupBy(entries, (e) => e.session.championshipId ?? 'hors-championnat',
      (e) => e.session.championship?.name ?? 'Hors championnat'), 'Championnat'],
    ['Par circuit', groupBy(entries, (e) => e.session.trackId, (e) => e.session.track?.name ?? null), 'Circuit'],
  ];
  for (const [heading, groups, header] of breakdowns) {
    if (groups.length === 0) continue;
    title(sheet, heading);
    addTable(sheet, recordColumns(header), groups);
    sheet.addRow([]);
  }

  return entries;
}

export function buildCarWorkbook(car) {
  return buildCarsWorkbook([car]);
}

/** One sheet per car, then a single list holding every session. */
export function buildCarsWorkbook(cars) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `RaceHubOS ${appVersion()}`;
  workbook.created = new Date();

  const taken = new Set();
  const all = cars.flatMap((car) =>
    addCarSheet(workbook, car, taken).map((entry) => ({ ...entry, owner: carLabel(car) })));

  const list = newSheet(workbook, sheetNameOf('Sessions', taken), TAB_COLORS.default);
  addSessionList(list, all, 'Pilote', (e) => e.driver?.name ?? null, cars.length > 1 ? 'Voiture' : null);

  return workbook;
}
