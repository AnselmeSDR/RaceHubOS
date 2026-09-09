import ExcelJS from 'exceljs';
import { createRequire } from 'module';
import { CAR_NUMBER_SPECS, CAR_TEXT_SPECS, ChampionshipMode, ChampionshipStatus, FuelMode, SessionStatus, SessionType, formatLevel, toLevel } from '@racehubos/shared';

/**
 * Excel export of a session or a championship.
 *
 * Lap times are written as real Excel durations — a fraction of a day — so they
 * stay sortable and can be averaged in a spreadsheet, and displayed with a
 * duration format so a human reads 1:12.345 rather than 0.00083.
 */

const MS_PER_DAY = 86_400_000;
export const DURATION_FORMAT = '[m]:ss.000';
export const DATE_FORMAT = 'dd/mm/yyyy hh:mm:ss';
// Les passages sont horodatés au millième : deux voitures franchissent la ligne
// dans la même seconde, l'ordre ne se lit que là
const TIMESTAMP_FORMAT = 'dd/mm/yyyy hh:mm:ss.000';

const INK = 'FF1B2A41';
const HEADER_FILL = 'FF1B2A41';
const HEADER_TEXT = 'FFFFFFFF';
const BAND_FILL = 'FFF4F6F9';
const RULE = 'FFD8DEE6';
const MUTED = 'FF6B7280';
const PODIUM_FILLS = ['FFFFF4CC', 'FFEDEFF2', 'FFF6E3D2'];

/** Version de l'application, lue une fois. */
let cachedVersion = null;
export function appVersion() {
  if (cachedVersion === null) {
    try {
      const require = createRequire(import.meta.url);
      cachedVersion = require('../../../../package.json').version ?? '';
    } catch {
      cachedVersion = '';
    }
  }
  return cachedVersion || 'inconnue';
}

const border = {
  top: { style: 'thin', color: { argb: RULE } },
  left: { style: 'thin', color: { argb: RULE } },
  bottom: { style: 'thin', color: { argb: RULE } },
  right: { style: 'thin', color: { argb: RULE } },
};

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** #3b3a38 or #f00 → FF3B3A38, so a colour column can actually be that colour. */
function toArgb(hex) {
  const clean = String(hex ?? '').replace('#', '').trim();
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `FF${[...clean].map((c) => c + c).join('').toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `FF${clean.toUpperCase()}`;
  return null;
}

/** Milliseconds as an Excel duration, or null when there is no time. */
export const duration = (ms) => (ms == null || ms <= 0 ? null : ms / MS_PER_DAY);

/**
 * A sheet with the presentation settings every sheet shares: no gridlines, so
 * the tables' own borders carry the structure, and a landscape page fitted to
 * the width for anyone who prints it.
 */
export function newSheet(workbook, name, tabColor) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: {
      left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3,
    } },
  });
  if (tabColor) sheet.properties.tabColor = { argb: tabColor };
  sheet.properties.defaultRowHeight = 16;
  return sheet;
}

export const sheetNameOf = (raw, taken) => {
  // Excel refuses : \ / ? * [ ] and anything past 31 characters
  const base = (raw || 'Session').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Session';
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, 31 - suffix.length) + suffix;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
};

/**
 * A header row, its data rows, and the column widths.
 *
 * Number formats are set cell by cell rather than on the column: a session
 * sheet holds several tables one above the other, and a column-wide duration
 * format would turn the lap count of the table above into a date.
 */
export function addTable(sheet, columns, rows, { podium = false } = {}) {
  const header = sheet.addRow(columns.map((c) => c.header));
  header.height = 20;
  header.eachCell((cell, i) => {
    if (i > columns.length) return;
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 10 };
    cell.fill = fill(HEADER_FILL);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });

  rows.forEach((row, index) => {
    const added = sheet.addRow(columns.map((c) => c.value(row)));
    added.height = 17;

    columns.forEach((column, i) => {
      const cell = added.getCell(i + 1);
      if (column.numFmt) cell.numFmt = column.numFmt;
      cell.border = border;
      cell.alignment = { vertical: 'middle', horizontal: column.align ?? (typeof cell.value === 'number' ? 'center' : 'left') };
      if (index % 2 === 1) cell.fill = fill(BAND_FILL);
      if (column.swatch) {
        const argb = toArgb(column.swatch(row));
        if (argb) {
          cell.fill = fill(argb);
          cell.font = { color: { argb } };
        }
      }
    });

    // Or, argent, bronze : le classement se lit d'un coup d'œil
    const rank = podium ? podium(row) : null;
    if (rank >= 1 && rank <= 3) {
      columns.forEach((_, i) => {
        const cell = added.getCell(i + 1);
        if (!columns[i].swatch) cell.fill = fill(PODIUM_FILLS[rank - 1]);
        if (rank === 1) cell.font = { ...cell.font, bold: true };
      });
    }
  });

  columns.forEach((column, i) => {
    const target = sheet.getColumn(i + 1);
    target.width = Math.max(target.width ?? 0, column.width ?? 16);
  });
  return header;
}

export const title = (sheet, text) => {
  const row = sheet.addRow([text]);
  row.height = 22;
  row.getCell(1).font = { bold: true, size: 12, color: { argb: INK } };
  row.getCell(1).alignment = { vertical: 'middle' };
  sheet.addRow([]);
  return row;
};

/**
 * Label / value line of a sheet header block.
 *
 * A line with nothing to say is left out rather than printed empty — but zero
 * is a value: « dont qualifications : 0 » tells the reader there was none.
 */
export function addField(sheet, label, value, numFmt) {
  if (value == null || value === '') return null;

  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { bold: true, size: 10, color: { argb: MUTED } };
  row.getCell(2).font = { size: 10, color: { argb: INK } };
  row.getCell(2).alignment = { horizontal: 'left' };
  if (numFmt) row.getCell(2).numFmt = numFmt;
  return row;
}

// ---------------------------------------------------------------------------
// Reference sheets

/**
 * Statistiques calculées sur le périmètre exporté.
 *
 * Les compteurs du modèle (`totalRaces`, `wins`, `podiums`, `bestLap`) ne sont
 * alimentés nulle part et valent zéro pour tout le monde. Et « trois victoires »
 * n'aurait de toute façon pas le même sens selon qu'on exporte une session ou
 * un championnat : ce qui est compté ici, c'est ce que le classeur contient.
 */
function statsBy(sessions, keyOf) {
  const stats = new Map();
  const of = (key) => {
    if (!stats.has(key)) stats.set(key, { ...EMPTY_STATS, positions: [] });
    return stats.get(key);
  };

  for (const session of sessions) {
    const isRace = session.type === SessionType.RACE;
    for (const entry of session.drivers ?? []) {
      const key = keyOf(entry);
      if (!key) continue;

      const stat = of(key);
      stat.sessions += 1;
      stat.laps += entry.totalLaps ?? 0;
      stat.totalTime += entry.totalTime ?? 0;
      if (entry.isDNF) stat.dnf += 1;
      if (isRace) {
        stat.races += 1;
        if (entry.finalPos != null) stat.positions.push(entry.finalPos);
        if (entry.finalPos === 1) stat.wins += 1;
        if (entry.finalPos != null && entry.finalPos <= 3) stat.podiums += 1;
      }
    }

    for (const lap of session.laps ?? []) {
      const key = keyOf(lap);
      if (!key || !lap.lapTime) continue;

      const stat = of(key);
      stat.lapCount += 1;
      stat.lapTimeSum += lap.lapTime;
      if (stat.bestLap == null || lap.lapTime < stat.bestLap) stat.bestLap = lap.lapTime;
    }
  }
  return stats;
}

const EMPTY_STATS = {
  sessions: 0, races: 0, wins: 0, podiums: 0, dnf: 0,
  laps: 0, totalTime: 0, bestLap: null, lapCount: 0, lapTimeSum: 0, positions: [],
};

const averagePosition = (stat) =>
  (stat.positions?.length ? stat.positions.reduce((a, b) => a + b, 0) / stat.positions.length : null);

const averageLap = (stat) => (stat.lapCount ? stat.lapTimeSum / stat.lapCount : null);

const statOf = (stats) => (item) => stats.get(item.id) ?? EMPTY_STATS;

/** Classement des pilotes sur un périmètre donné, meilleur d'abord. */
function addDriverStandings(sheet, drivers, driverStats, heading = 'Pilotes') {
  if (drivers.length === 0) return;

  const stat = statOf(driverStats);
  const ranked = [...drivers].sort((a, b) =>
    stat(b).wins - stat(a).wins
    || stat(b).podiums - stat(a).podiums
    || (stat(a).bestLap ?? Infinity) - (stat(b).bestLap ?? Infinity));

  title(sheet, heading);
  addTable(sheet, [
    { header: 'Nom', value: (d) => d.name, width: 24 },
    { header: 'Numéro', value: (d) => d.number ?? null, width: 9 },
    { header: 'Équipe', value: (d) => d.team?.name ?? null, width: 18 },
    { header: 'Couleur', value: () => null, swatch: (d) => d.color, width: 9 },
    { header: 'Sessions', value: (d) => stat(d).sessions, width: 9 },
    { header: 'Courses', value: (d) => stat(d).races, width: 9 },
    { header: 'Victoires', value: (d) => stat(d).wins, width: 9 },
    { header: 'Podiums', value: (d) => stat(d).podiums, width: 9 },
    { header: 'Abandons', value: (d) => stat(d).dnf, width: 9 },
    { header: 'Position moyenne', value: (d) => averagePosition(stat(d)), width: 16, numFmt: '0.0' },
    { header: 'Tours', value: (d) => stat(d).laps, width: 8 },
    { header: 'Temps total', value: (d) => duration(stat(d).totalTime), width: 13, numFmt: DURATION_FORMAT },
    { header: 'Meilleur tour', value: (d) => duration(stat(d).bestLap), width: 13, numFmt: DURATION_FORMAT },
    { header: 'Tour moyen', value: (d) => duration(averageLap(stat(d))), width: 13, numFmt: DURATION_FORMAT },
  ], ranked);
  sheet.addRow([]);
}

/** Classement des voitures sur un périmètre donné. */
function addCarStandings(sheet, cars, carStats, heading = 'Voitures') {
  if (cars.length === 0) return;

  const stat = statOf(carStats);
  const ranked = [...cars].sort((a, b) =>
    stat(b).wins - stat(a).wins
    || (stat(a).bestLap ?? Infinity) - (stat(b).bestLap ?? Infinity));

  title(sheet, heading);
  addTable(sheet, [
    { header: 'Marque', value: (c) => c.brand, width: 16 },
    { header: 'Modèle', value: (c) => c.model, width: 24 },
    { header: 'Année', value: (c) => c.year ?? null, width: 8 },
    { header: 'Couleur', value: () => null, swatch: (c) => c.color, width: 9 },
    { header: 'Vitesse', value: (c) => toLevel(c.maxSpeed), width: 9 },
    { header: 'Freinage', value: (c) => toLevel(c.brakeForce), width: 9 },
    { header: 'Réservoir', value: (c) => toLevel(c.fuelCapacity), width: 9 },
    { header: 'Sessions', value: (c) => stat(c).sessions, width: 9 },
    { header: 'Courses', value: (c) => stat(c).races, width: 9 },
    { header: 'Victoires', value: (c) => stat(c).wins, width: 9 },
    { header: 'Podiums', value: (c) => stat(c).podiums, width: 9 },
    { header: 'Abandons', value: (c) => stat(c).dnf, width: 9 },
    { header: 'Position moyenne', value: (c) => averagePosition(stat(c)), width: 16, numFmt: '0.0' },
    { header: 'Tours', value: (c) => stat(c).laps, width: 8 },
    { header: 'Meilleur tour', value: (c) => duration(stat(c).bestLap), width: 13, numFmt: DURATION_FORMAT },
    { header: 'Tour moyen', value: (c) => duration(averageLap(stat(c))), width: 13, numFmt: DURATION_FORMAT },
    // Seules les caractéristiques renseignées : sinon dix-sept colonnes vides
    ...carSpecColumns(cars),
  ], ranked);
  sheet.addRow([]);
}

function addReferenceSheet(workbook, { drivers, cars, teams, tracks }, driverStats, carStats, bests) {
  const sheet = newSheet(workbook, 'Référence', TAB_COLORS.reference);

  addDriverStandings(sheet, drivers, driverStats);
  addCarStandings(sheet, cars, carStats);

  if (teams.length > 0) {
    title(sheet, 'Équipes');
    addTable(sheet, [
      { header: 'Nom', value: (t) => t.name, width: 22 },
      { header: 'Couleur', value: () => null, swatch: (t) => t.color, width: 9 },
      { header: 'Pilotes', value: (t) => drivers.filter((d) => d.teamId === t.id).length, width: 9 },
      {
        header: 'Composition',
        value: (t) => drivers.filter((d) => d.teamId === t.id).map((d) => d.name).join(', '),
        width: 46,
      },
    ], teams);
    sheet.addRow([]);
  }

  if (tracks.length > 0) {
    title(sheet, 'Circuits');
    addTable(sheet, [
      { header: 'Nom', value: (t) => t.name, width: 26 },
      { header: 'Tracé', value: (t) => t.layout ?? null, width: 14 },
      { header: 'Longueur (m)', value: (t) => t.length ?? null, width: 12 },
      { header: 'Virages', value: (t) => t.corners ?? null, width: 9 },
      { header: 'Sessions', value: (t) => bests.get(t.id)?.sessions ?? 0, width: 9 },
      { header: 'Tours', value: (t) => bests.get(t.id)?.laps ?? 0, width: 8 },
      { header: 'Meilleur tour', value: (t) => duration(bests.get(t.id)?.lapTime), width: 13, numFmt: DURATION_FORMAT },
      { header: 'Détenteur', value: (t) => bests.get(t.id)?.driver ?? null, width: 22 },
      { header: 'Voiture', value: (t) => bests.get(t.id)?.car ?? null, width: 24 },
    ], tracks);
  }
}

// ---------------------------------------------------------------------------
// Session sheets

/** Libellés des caractéristiques, partagés par les feuilles qui les montrent. */
export const CAR_SPEC_LABELS = {
  scale: 'Échelle', chassis: 'Châssis', motor: 'Moteur', gearRatio: 'Rapport',
  tyresFront: 'Pneus avant', tyresRear: 'Pneus arrière', guide: 'Guide',
  braids: 'Tresses', magnet: 'Aimant', notes: 'Notes',
  weightGrams: 'Poids (g)', lengthMm: 'Longueur (mm)', widthMm: 'Largeur (mm)',
  wheelbaseMm: 'Empattement (mm)', frontTrackMm: 'Voie avant (mm)',
  rearTrackMm: 'Voie arrière (mm)', groundClearanceMm: 'Garde au sol (mm)',
};

/** Colonnes des caractéristiques réellement renseignées sur au moins une voiture. */
export function carSpecColumns(cars) {
  return [...CAR_TEXT_SPECS, ...CAR_NUMBER_SPECS]
    .filter((field) => field !== 'notes')
    .filter((field) => cars.some((car) => car?.[field] != null && car[field] !== ''))
    .map((field) => ({
      header: CAR_SPEC_LABELS[field] ?? field,
      value: (car) => car[field] ?? null,
      width: 14,
    }));
}

export const SESSION_TYPE_LABELS = {
  [SessionType.PRACTICE]: 'Essais libres',
  [SessionType.QUALIF]: 'Qualifications',
  [SessionType.RACE]: 'Course',
  [SessionType.BALANCING]: 'Équilibrage',
};

const SESSION_STATUS_LABELS = {
  [SessionStatus.DRAFT]: 'brouillon',
  [SessionStatus.READY]: 'prête',
  [SessionStatus.ACTIVE]: 'en cours',
  [SessionStatus.PAUSED]: 'en pause',
  [SessionStatus.FINISHING]: 'dernier tour',
  [SessionStatus.FINISHED]: 'terminée',
};

const CHAMPIONSHIP_STATUS_LABELS = {
  [ChampionshipStatus.PLANNED]: 'planifié',
  [ChampionshipStatus.ACTIVE]: 'en cours',
  [ChampionshipStatus.FINISHED]: 'terminé',
};

/** Onglets teintés par nature, pour se repérer dans un championnat de vingt courses. */
export const TAB_COLORS = {
  championship: 'FF1B2A41',
  reference: 'FF6B7280',
  [SessionType.PRACTICE]: 'FF9CA3AF',
  [SessionType.QUALIF]: 'FF3B82F6',
  [SessionType.RACE]: 'FF16A34A',
  [SessionType.BALANCING]: 'FFA855F7',
  default: 'FF9CA3AF',
};

const asDate = (value) => (value ? new Date(value) : null);

function addSessionSheet(workbook, session, taken) {
  const sheet = newSheet(
    workbook,
    sheetNameOf(session.name || SESSION_TYPE_LABELS[session.type], taken),
    TAB_COLORS[session.type] ?? TAB_COLORS.default,
  );
  title(sheet, session.name || SESSION_TYPE_LABELS[session.type] || 'Session');

  for (const [label, value, numFmt] of [
    ['Type', SESSION_TYPE_LABELS[session.type] ?? session.type],
    ['Circuit', session.track?.name ?? null],
    ['Championnat', session.championship?.name ?? null],
    ['Statut', SESSION_STATUS_LABELS[session.status] ?? session.status],
    ['Durée max', duration(session.maxDuration), DURATION_FORMAT],
    ['Tours max', session.maxLaps ?? null],
    ['Période de grâce', duration(session.gracePeriod), DURATION_FORMAT],
    ['Carburant', session.fuelMode === FuelMode.ON ? 'activé' : 'désactivé'],
    ['Départ', asDate(session.startedAt), DATE_FORMAT],
    ['Fin', asDate(session.finishedAt), DATE_FORMAT],
    ['Version Control Unit', session.cuVersion || 'non communiquée'],
    ['Version RaceHubOS', appVersion()],
  ]) {
    addField(sheet, label, value, numFmt);
  }
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 30;
  sheet.addRow([]);

  const entries = [...(session.drivers ?? [])].sort(
    (a, b) => (a.gridPos ?? a.controller) - (b.gridPos ?? b.controller),
  );

  title(sheet, 'Engagements');
  addTable(sheet, [
    { header: 'Manette', value: (e) => e.controller + 1, width: 9 },
    { header: 'Pilote', value: (e) => e.driver?.name ?? null, width: 22 },
    { header: 'Voiture', value: (e) => (e.car ? `${e.car.brand} ${e.car.model}` : null), width: 26 },
    // Réglages actuels de la voiture : ils ne sont pas encore figés par session (TASK-37)
    { header: 'Vitesse', value: (e) => (e.car ? formatLevel(e.car.maxSpeed) : null), width: 9 },
    { header: 'Freinage', value: (e) => (e.car ? formatLevel(e.car.brakeForce) : null), width: 9 },
    { header: 'Réservoir', value: (e) => (e.car ? formatLevel(e.car.fuelCapacity) : null), width: 10 },
    { header: 'Départ', value: (e) => e.gridPos ?? null, width: 8 },
    { header: 'Arrivée', value: (e) => e.finalPos ?? null, width: 8 },
    { header: 'Tours', value: (e) => e.totalLaps, width: 8 },
    { header: 'Temps total', value: (e) => duration(e.totalTime), width: 13, numFmt: DURATION_FORMAT },
    { header: 'Meilleur tour', value: (e) => duration(e.bestLapTime), width: 13, numFmt: DURATION_FORMAT },
    { header: 'Dernier tour', value: (e) => duration(e.lastLapTime), width: 13, numFmt: DURATION_FORMAT },
    { header: 'Abandon', value: (e) => (e.isDNF ? 'oui' : ''), width: 9 },
  ], entries, { podium: (e) => e.finalPos });
  sheet.addRow([]);

  const laps = [...(session.laps ?? [])].sort(
    (a, b) => a.lapNumber - b.lapNumber || a.controller - b.controller,
  );

  title(sheet, 'Tours');
  addTable(sheet, [
    { header: 'Tour', value: (l) => l.lapNumber, width: 7 },
    { header: 'Manette', value: (l) => l.controller + 1, width: 9 },
    { header: 'Pilote', value: (l) => l.driver?.name ?? null, width: 22 },
    { header: 'Voiture', value: (l) => (l.car ? `${l.car.brand} ${l.car.model}` : null), width: 26 },
    { header: 'Temps', value: (l) => duration(l.lapTime), width: 12, numFmt: DURATION_FORMAT },
    { header: 'S1', value: (l) => duration(l.sector1), width: 10, numFmt: DURATION_FORMAT },
    { header: 'S2', value: (l) => duration(l.sector2), width: 10, numFmt: DURATION_FORMAT },
    { header: 'S3', value: (l) => duration(l.sector3), width: 10, numFmt: DURATION_FORMAT },
    { header: 'Horodatage', value: (l) => asDate(l.timestamp), width: 22, numFmt: TIMESTAMP_FORMAT },
  ], laps);
}

function addChampionshipSheet(workbook, championship, taken) {
  const name = sheetNameOf(championship.name || 'Championnat', taken);
  const sheet = newSheet(workbook, name, TAB_COLORS.championship);
  title(sheet, championship.name);

  const sessions = championship.sessions ?? [];
  const countOf = (type) => sessions.filter((s) => s.type === type).length;

  /**
   * Les réglages du championnat ne sont renseignés qu'en mode automatique : en
   * manuel, chaque session porte les siens. Plutôt que d'afficher des cases
   * vides, on lit ce qui a réellement été couru.
   */
  const observed = (type, field) => {
    const values = sessions.filter((s) => s.type === type).map((s) => s[field]).filter((v) => v != null);
    if (values.length === 0) return null;
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : unique;
  };
  const settingOf = (declared, type, field, numFmt) => {
    if (declared != null) return [declared, numFmt];
    const value = observed(type, field);
    if (value == null) return [null, numFmt];
    // Plusieurs valeurs : on les liste, on n'en invente pas une
    if (Array.isArray(value)) return [value.join(', '), null];
    return [value, numFmt];
  };
  const asDuration = (declared, type, field) => {
    const [value, fmt] = settingOf(declared, type, field, DURATION_FORMAT);
    return typeof value === 'number' ? [duration(value), fmt] : [value, null];
  };

  /** À défaut de participants déclarés, ceux qui ont réellement couru. */
  const declared = (championship.participants ?? []).map((p) => p.driver?.name).filter(Boolean);
  const raced = [...new Set(
    sessions.flatMap((s) => (s.drivers ?? []).map((d) => d.driver?.name)).filter(Boolean),
  )];
  const participants = declared.length > 0 ? declared : raced;

  const [qualifDuration, qualifDurationFmt] = asDuration(championship.qualifMaxDuration, SessionType.QUALIF, 'maxDuration');
  const [qualifLaps] = settingOf(championship.qualifMaxLaps, SessionType.QUALIF, 'maxLaps');
  const [raceDuration, raceDurationFmt] = asDuration(championship.raceMaxDuration, SessionType.RACE, 'maxDuration');
  const [raceLaps] = settingOf(championship.raceMaxLaps, SessionType.RACE, 'maxLaps');

  for (const [label, value, numFmt] of [
    ['Saison', championship.season],
    ['Statut', CHAMPIONSHIP_STATUS_LABELS[championship.status] ?? championship.status],
    ['Circuit', championship.track?.name ?? null],
    ['Mode', championship.mode === ChampionshipMode.AUTO ? 'automatique' : 'manuel'],
    ['Sessions', sessions.length],
    ['dont essais libres', countOf(SessionType.PRACTICE)],
    ['dont qualifications', countOf(SessionType.QUALIF)],
    ['dont courses', countOf(SessionType.RACE)],
    ['Durée de qualification', qualifDuration, qualifDurationFmt],
    ['Tours de qualification', qualifLaps],
    ['Durée de course', raceDuration, raceDurationFmt],
    ['Tours de course', raceLaps],
    ['Pilotes par qualification', championship.driversPerQualif ?? null],
    ['Pilotes par course', championship.driversPerRace ?? null],
    [`Participants (${participants.length})`, participants.join(', ')],
    ['Tours parcourus', sessions.reduce((total, s) => total + (s.laps ?? []).length, 0)],
    ['Exporté le', new Date(), DATE_FORMAT],
    ['Version RaceHubOS', appVersion()],
  ]) {
    addField(sheet, label, value, numFmt);
  }
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 70;
  sheet.addRow([]);

  // Classement propre à ce championnat : la feuille Référence cumule tout
  // l'export, elle ne dit pas qui a gagné quoi dans lequel
  const { drivers, cars } = referencesOf(sessions);
  addDriverStandings(sheet, drivers, statsBy(sessions, (row) => row.driverId ?? row.driver?.id), 'Classement pilotes');
  addCarStandings(sheet, cars, statsBy(sessions, (row) => row.carId ?? row.car?.id), 'Classement voitures');
}

// ---------------------------------------------------------------------------

/** Every driver, car, track and team the given sessions actually used. */
function referencesOf(sessions) {
  const byId = (items) => [...new Map(items.filter(Boolean).map((i) => [i.id, i])).values()];
  const entries = sessions.flatMap((s) => s.drivers ?? []);

  const drivers = byId(entries.map((e) => e.driver));
  return {
    drivers,
    cars: byId(entries.map((e) => e.car)),
    tracks: byId(sessions.map((s) => s.track)),
    teams: byId(drivers.map((d) => d.team)),
  };
}

/** Meilleur tour de chaque circuit sur le périmètre, et qui l'a signé. */
function trackBests(sessions) {
  const bests = new Map();

  for (const session of sessions) {
    const trackId = session.trackId ?? session.track?.id;
    if (!trackId) continue;

    if (!bests.has(trackId)) bests.set(trackId, { sessions: 0, laps: 0, lapTime: null, driver: null, car: null });
    const best = bests.get(trackId);
    best.sessions += 1;

    for (const lap of session.laps ?? []) {
      if (!lap.lapTime) continue;
      best.laps += 1;
      if (best.lapTime == null || lap.lapTime < best.lapTime) {
        best.lapTime = lap.lapTime;
        best.driver = lap.driver?.name ?? null;
        best.car = lap.car ? `${lap.car.brand} ${lap.car.model}` : null;
      }
    }
  }
  return bests;
}

/**
 * Sheet order: the overview first, then each championship immediately followed
 * by its own sessions. Grouping matters as soon as two championships are
 * exported together — otherwise their races end up interleaved behind them, and
 * nothing says which race belonged to which championship.
 */
function buildWorkbook(sessions, championships = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `RaceHubOS ${appVersion()}`;
  workbook.lastModifiedBy = workbook.creator;
  workbook.created = new Date();

  const taken = new Set();
  addReferenceSheet(
    workbook,
    referencesOf(sessions),
    statsBy(sessions, (row) => row.driverId ?? row.driver?.id),
    statsBy(sessions, (row) => row.carId ?? row.car?.id),
    trackBests(sessions),
  );
  taken.add('Référence');

  const written = new Set();
  for (const championship of championships) {
    addChampionshipSheet(workbook, championship, taken);
    for (const session of championship.sessions ?? []) {
      addSessionSheet(workbook, session, taken);
      written.add(session.id);
    }
  }

  // Les sessions hors championnat, ou l'export d'une sélection de sessions
  for (const session of sessions) {
    if (written.has(session.id)) continue;
    addSessionSheet(workbook, session, taken);
  }

  return workbook;
}

export function buildSessionWorkbook(session) {
  return buildWorkbook([session]);
}

export function buildChampionshipWorkbook(championship) {
  return buildWorkbook(championship.sessions ?? [], [championship]);
}

/** One workbook for a hand-picked set of sessions. */
export function buildSessionsWorkbook(sessions) {
  return buildWorkbook(sessions);
}

/** One workbook for several championships, each with its own sheet. */
export function buildChampionshipsWorkbook(championships) {
  return buildWorkbook(championships.flatMap((c) => c.sessions ?? []), championships);
}

/** Safe file name for a browser download. */
export function exportFileName(label) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (label || 'export')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'export';
  return `${date}_${slug}.xlsx`;
}
