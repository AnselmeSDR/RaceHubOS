import { ChampionshipMode, FuelMode, SessionType, formatLevel } from '@racehubos/shared';
import {
  DATE_FORMAT,
  DURATION_FORMAT,
  TIMESTAMP_FORMAT,
  addFields,
  addTable,
  appVersion,
  asDate,
  duration,
  newSheet,
  sheetNameOf,
  title,
} from './format.js';
import {
  CHAMPIONSHIP_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  TAB_COLORS,
  carLabel,
  carSpecColumns,
} from './labels.js';
import { addCarStandings, addDriverStandings } from './standings.js';
import { carKey, driverKey, referencesOf, statsBy, trackBests } from './scope.js';

/** The overview: standings of every driver and car exported, then the teams and tracks. */
export function addReferenceSheet(workbook, sessions) {
  const { drivers, cars, teams, tracks } = referencesOf(sessions);
  const sheet = newSheet(workbook, 'Référence', TAB_COLORS.reference);

  addDriverStandings(sheet, drivers, statsBy(sessions, driverKey));
  addCarStandings(sheet, cars, statsBy(sessions, carKey));

  if (teams.length > 0) {
    const membersOf = (team) => drivers.filter((d) => d.teamId === team.id);
    title(sheet, 'Équipes');
    addTable(
      sheet,
      [
        { header: 'Nom', value: (t) => t.name, width: 22 },
        { header: 'Couleur', value: () => null, swatch: (t) => t.color, width: 9 },
        { header: 'Pilotes', value: (t) => membersOf(t).length, width: 9 },
        {
          header: 'Composition',
          value: (t) =>
            membersOf(t)
              .map((d) => d.name)
              .join(', '),
          width: 46,
        },
      ],
      teams
    );
    sheet.addRow([]);
  }

  if (tracks.length > 0) {
    const bests = trackBests(sessions);
    title(sheet, 'Circuits');
    addTable(
      sheet,
      [
        { header: 'Nom', value: (t) => t.name, width: 26 },
        { header: 'Tracé', value: (t) => t.layout ?? null, width: 14 },
        { header: 'Longueur (m)', value: (t) => t.length ?? null, width: 12 },
        { header: 'Virages', value: (t) => t.corners ?? null, width: 9 },
        { header: 'Sessions', value: (t) => bests.get(t.id)?.sessions ?? 0, width: 9 },
        { header: 'Tours', value: (t) => bests.get(t.id)?.laps ?? 0, width: 8 },
        {
          header: 'Meilleur tour',
          value: (t) => duration(bests.get(t.id)?.lapTime),
          width: 13,
          numFmt: DURATION_FORMAT,
        },
        { header: 'Détenteur', value: (t) => bests.get(t.id)?.driver ?? null, width: 22 },
        { header: 'Voiture', value: (t) => bests.get(t.id)?.car ?? null, width: 24 },
      ],
      tracks
    );
  }
}

/** A session: its settings, the entries on the grid, then every lap. */
export function addSessionSheet(workbook, session, taken) {
  const typeLabel = SESSION_TYPE_LABELS[session.type];
  const sheet = newSheet(
    workbook,
    sheetNameOf(session.name || typeLabel, taken),
    TAB_COLORS[session.type] ?? TAB_COLORS.default
  );
  title(sheet, session.name || typeLabel || 'Session');

  addFields(sheet, [
    ['Type', typeLabel ?? session.type],
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
  ]);
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 30;
  sheet.addRow([]);

  const entries = [...(session.drivers ?? [])].sort(
    (a, b) => (a.gridPos ?? a.controller) - (b.gridPos ?? b.controller)
  );
  const ofCar = (read) => (e) => (e.car ? read(e.car) : null);

  title(sheet, 'Engagements');
  addTable(
    sheet,
    [
      { header: 'Manette', value: (e) => e.controller + 1, width: 9 },
      { header: 'Pilote', value: (e) => e.driver?.name ?? null, width: 22 },
      { header: 'Voiture', value: (e) => carLabel(e.car), width: 26 },
      // Réglages actuels de la voiture : ils ne sont pas encore figés par session (TASK-37)
      { header: 'Vitesse', value: ofCar((car) => formatLevel(car.maxSpeed)), width: 9 },
      { header: 'Freinage', value: ofCar((car) => formatLevel(car.brakeForce)), width: 9 },
      { header: 'Réservoir', value: ofCar((car) => formatLevel(car.fuelCapacity)), width: 10 },
      { header: 'Départ', value: (e) => e.gridPos ?? null, width: 8 },
      { header: 'Arrivée', value: (e) => e.finalPos ?? null, width: 8 },
      { header: 'Tours', value: (e) => e.totalLaps, width: 8 },
      { header: 'Temps total', value: (e) => duration(e.totalTime), width: 13, numFmt: DURATION_FORMAT },
      { header: 'Meilleur tour', value: (e) => duration(e.bestLapTime), width: 13, numFmt: DURATION_FORMAT },
      { header: 'Dernier tour', value: (e) => duration(e.lastLapTime), width: 13, numFmt: DURATION_FORMAT },
      { header: 'Abandon', value: (e) => (e.isDNF ? 'oui' : ''), width: 9 },
      // L'équipement de la voiture engagée, quand il est renseigné
      ...carSpecColumns(entries.map((e) => e.car).filter(Boolean)).map((column) => ({
        ...column,
        value: ofCar(column.value),
      })),
    ],
    entries,
    { podium: (e) => e.finalPos }
  );
  sheet.addRow([]);

  const laps = [...(session.laps ?? [])].sort((a, b) => a.lapNumber - b.lapNumber || a.controller - b.controller);

  title(sheet, 'Tours');
  addTable(
    sheet,
    [
      { header: 'Tour', value: (l) => l.lapNumber, width: 7 },
      { header: 'Manette', value: (l) => l.controller + 1, width: 9 },
      { header: 'Pilote', value: (l) => l.driver?.name ?? null, width: 22 },
      { header: 'Voiture', value: (l) => carLabel(l.car), width: 26 },
      { header: 'Temps', value: (l) => duration(l.lapTime), width: 12, numFmt: DURATION_FORMAT },
      { header: 'S1', value: (l) => duration(l.sector1), width: 10, numFmt: DURATION_FORMAT },
      { header: 'S2', value: (l) => duration(l.sector2), width: 10, numFmt: DURATION_FORMAT },
      { header: 'S3', value: (l) => duration(l.sector3), width: 10, numFmt: DURATION_FORMAT },
      { header: 'Horodatage', value: (l) => asDate(l.timestamp), width: 22, numFmt: TIMESTAMP_FORMAT },
    ],
    laps
  );
}

/**
 * Les réglages du championnat ne sont renseignés qu'en mode automatique : en
 * manuel, chaque session porte les siens. Plutôt que d'afficher des cases
 * vides, on lit ce qui a réellement été couru — et plusieurs valeurs se listent,
 * on n'en invente pas une.
 *
 * @returns {[value, numFmt]} the setting and its format (none for a list)
 */
function settingOf(sessions, declared, type, field, numFmt) {
  if (declared != null) return [declared, numFmt];
  const values = [...new Set(sessions.filter((s) => s.type === type && s[field] != null).map((s) => s[field]))];
  if (values.length === 0) return [null, numFmt];
  if (values.length > 1) return [values.join(', '), null];
  return [values[0], numFmt];
}

/** A duration setting, as an Excel duration when it is a single value. */
function durationSettingOf(sessions, declared, type, field) {
  const [value, numFmt] = settingOf(sessions, declared, type, field, DURATION_FORMAT);
  return typeof value === 'number' ? [duration(value), numFmt] : [value, null];
}

/** A championship: its settings and participants, then its own driver and car standings. */
export function addChampionshipSheet(workbook, championship, taken) {
  const sheet = newSheet(workbook, sheetNameOf(championship.name || 'Championnat', taken), TAB_COLORS.championship);
  title(sheet, championship.name);

  const sessions = championship.sessions ?? [];
  const countOf = (type) => sessions.filter((s) => s.type === type).length;

  // À défaut de participants déclarés, ceux qui ont réellement couru
  const declared = (championship.participants ?? []).map((p) => p.driver?.name).filter(Boolean);
  const raced = [...new Set(sessions.flatMap((s) => (s.drivers ?? []).map((d) => d.driver?.name)).filter(Boolean))];
  const participants = declared.length > 0 ? declared : raced;

  const [qualifDuration, qualifDurationFmt] = durationSettingOf(
    sessions,
    championship.qualifMaxDuration,
    SessionType.QUALIF,
    'maxDuration'
  );
  const [raceDuration, raceDurationFmt] = durationSettingOf(
    sessions,
    championship.raceMaxDuration,
    SessionType.RACE,
    'maxDuration'
  );
  const [qualifLaps] = settingOf(sessions, championship.qualifMaxLaps, SessionType.QUALIF, 'maxLaps');
  const [raceLaps] = settingOf(sessions, championship.raceMaxLaps, SessionType.RACE, 'maxLaps');

  addFields(sheet, [
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
  ]);
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 70;
  sheet.addRow([]);

  // Classement propre à ce championnat : la feuille Référence cumule tout
  // l'export, elle ne dit pas qui a gagné quoi dans lequel
  const { drivers, cars } = referencesOf(sessions);
  addDriverStandings(sheet, drivers, statsBy(sessions, driverKey), 'Classement pilotes');
  addCarStandings(sheet, cars, statsBy(sessions, carKey), 'Classement voitures');
}
