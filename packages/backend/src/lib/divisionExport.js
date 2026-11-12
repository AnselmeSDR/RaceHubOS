import { DivisionScope } from '@racehubos/shared';
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
import { CHAMPIONSHIP_STATUS_LABELS, TAB_COLORS, carLabel } from './excel/labels.js';

/**
 * Excel export of divisions: one sheet per division (its members and championships), then every
 * link — which driver or car is in which division, since when — in a single list.
 * Works on divisions shaped by `divisionDetail`.
 */

const DAY_FORMAT = 'dd/mm/yyyy';

const isCategory = (division) => division.scope === DivisionScope.CAR;
const kindOf = (division) => (isCategory(division) ? 'Catégorie de voitures' : 'Division de pilotes');

/** The member's other divisions, this one left out. */
const othersOf = (division) => (member) =>
  (member.divisions ?? [])
    .filter((other) => other.id !== division.id)
    .map((other) => other.name)
    .join(', ') || null;

const since = { header: 'Membre depuis', value: (m) => new Date(m.since), width: 14, numFmt: DAY_FORMAT };
const races = { header: 'Courses', value: (m) => m.races ?? 0, width: 9 };
const bestLap = { header: 'Meilleur tour', value: (m) => duration(m.bestLap), width: 13, numFmt: DURATION_FORMAT };

const driverColumns = (division) => [
  { header: 'Pilote', value: (d) => d.name, width: 24 },
  { header: 'Numéro', value: (d) => d.number ?? null, width: 9 },
  since,
  { header: 'Autres divisions', value: othersOf(division), width: 22 },
  races,
  { header: 'Victoires', value: (d) => d.wins ?? 0, width: 9 },
  { header: 'Podiums', value: (d) => d.podiums ?? 0, width: 9 },
  bestLap,
];

const carColumns = (division) => [
  { header: 'Voiture', value: carLabel, width: 28 },
  { header: 'Année', value: (c) => c.year ?? null, width: 8 },
  since,
  { header: 'Autres catégories', value: othersOf(division), width: 22 },
  races,
  bestLap,
];

const championshipColumns = [
  { header: 'Championnat', value: (c) => c.name, width: 28 },
  { header: 'Circuit', value: (c) => c.track?.name ?? null, width: 22 },
  { header: 'Saison', value: (c) => c.season, width: 9 },
  { header: 'Statut', value: (c) => CHAMPIONSHIP_STATUS_LABELS[c.status] ?? c.status, width: 12 },
];

const membersOf = (division) => (isCategory(division) ? division.cars : division.drivers) ?? [];

function addDivisionSheet(workbook, taken, division) {
  const sheet = newSheet(workbook, sheetNameOf(division.name, taken), TAB_COLORS.reference);
  title(sheet, division.name);
  addFields(sheet, [
    ['Type', kindOf(division)],
    ['Nom court', division.shortName ?? null],
    [isCategory(division) ? 'Ordre' : 'Échelon', division.order],
    ['Couleur', division.color],
  ]);
  addField(sheet, 'Exporté le', new Date(), DATE_FORMAT);
  addField(sheet, 'Version RaceHubOS', appVersion());
  sheet.addRow([]);

  const members = membersOf(division);
  title(sheet, `${isCategory(division) ? 'Voitures' : 'Pilotes'} (${members.length})`);
  addTable(sheet, (isCategory(division) ? carColumns : driverColumns)(division), members);
  sheet.addRow([]);

  const championships = division.championships ?? [];
  title(sheet, `Championnats (${championships.length})`);
  addTable(sheet, championshipColumns, championships);
}

const linkColumns = [
  { header: 'Division', value: (l) => l.division.name, width: 20 },
  { header: 'Type', value: (l) => kindOf(l.division), width: 22 },
  { header: 'Membre', value: (l) => l.name, width: 28 },
  { header: 'Depuis', value: (l) => new Date(l.since), width: 12, numFmt: DAY_FORMAT },
];

/** One sheet per division, then every link between a division and a driver or a car. */
export function buildDivisionsWorkbook(divisions) {
  const workbook = newWorkbook();
  const taken = new Set();
  for (const division of divisions) addDivisionSheet(workbook, taken, division);

  const links = divisions.flatMap((division) =>
    membersOf(division).map((member) => ({
      division,
      name: isCategory(division) ? carLabel(member) : member.name,
      since: member.since,
    }))
  );
  const list = newSheet(workbook, sheetNameOf('Liens', taken), TAB_COLORS.default);
  title(list, `Liens (${links.length})`);
  addTable(list, linkColumns, links);
  return workbook;
}
