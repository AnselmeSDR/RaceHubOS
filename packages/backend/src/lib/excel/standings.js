import { toLevel } from '@racehubos/shared';
import { DURATION_FORMAT, addTable, duration, title } from './format.js';
import { carSpecColumns } from './labels.js';
import { averagePosition } from './record.js';
import { averageLap, statOf } from './scope.js';
import { divisionNames } from '../divisions.js';

const byBestLap = (stat) => (a, b) => (stat(a).bestLap ?? Infinity) - (stat(b).bestLap ?? Infinity);

/** Classement des pilotes sur un périmètre donné, meilleur d'abord. */
export function addDriverStandings(sheet, drivers, driverStats, heading = 'Pilotes') {
  if (drivers.length === 0) return;

  const stat = statOf(driverStats);
  const ranked = [...drivers].sort(
    (a, b) => stat(b).wins - stat(a).wins || stat(b).podiums - stat(a).podiums || byBestLap(stat)(a, b)
  );

  title(sheet, heading);
  addTable(
    sheet,
    [
      { header: 'Nom', value: (d) => d.name, width: 24 },
      { header: 'Numéro', value: (d) => d.number ?? null, width: 9 },
      { header: 'Divisions', value: divisionNames, width: 18 },
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
    ],
    ranked
  );
  sheet.addRow([]);
}

/** Classement des voitures sur un périmètre donné. */
export function addCarStandings(sheet, cars, carStats, heading = 'Voitures') {
  if (cars.length === 0) return;

  const stat = statOf(carStats);
  const ranked = [...cars].sort((a, b) => stat(b).wins - stat(a).wins || byBestLap(stat)(a, b));

  title(sheet, heading);
  addTable(
    sheet,
    [
      { header: 'Marque', value: (c) => c.brand, width: 16 },
      { header: 'Modèle', value: (c) => c.model, width: 24 },
      { header: 'Année', value: (c) => c.year ?? null, width: 8 },
      { header: 'Catégories', value: divisionNames, width: 14 },
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
    ],
    ranked
  );
  sheet.addRow([]);
}
