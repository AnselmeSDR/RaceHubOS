import ExcelJS from 'exceljs';
import { SessionType } from '@racehubos/shared';
import {
  buildChampionshipWorkbook,
  buildChampionshipsWorkbook,
  buildSessionWorkbook,
  buildSessionsWorkbook,
  exportFileName,
} from '../lib/excelExport.js';

const MS_PER_DAY = 86_400_000;

const team = { id: 'team-1', name: 'Écurie Bleue', color: '#00f' };
const driver = (id, name) => ({
  id, name, color: '#f00', number: 8, teamId: team.id, team,
  totalRaces: 12, wins: 3, podiums: 7, bestLap: 9_500, isReference: false,
});
const car = (id, model) => ({
  id, brand: 'Audi', model, year: 2024, color: '#0f0',
  maxSpeed: 70, brakeForce: 60, fuelCapacity: 100, totalRaces: 12, bestLap: 9_800,
});
const track = { id: 'track-1', name: 'Creutzwald Ring', layout: 'A', length: 24.5, corners: 8, bestLap: 9_100, bestLapBy: 'Anselme' };

const session = (overrides = {}) => ({
  id: 'session-1',
  name: '14h00',
  type: SessionType.RACE,
  status: 'finished',
  fuelMode: 'OFF',
  maxDuration: 300_000,
  maxLaps: null,
  gracePeriod: 30_000,
  startedAt: new Date('2026-08-15T12:15:13Z'),
  finishedAt: new Date('2026-08-15T12:20:39Z'),
  cuVersion: '5331',
  track,
  championship: null,
  drivers: [
    {
      id: 'sd-1', controller: 0, gridPos: 1, finalPos: 1, totalLaps: 26,
      totalTime: 277_394, bestLapTime: 9_356, lastLapTime: 9_800, isDNF: false,
      driver: driver('d-1', 'Anselme SDR'), car: car('c-1', 'R8 LMS'),
    },
    {
      id: 'sd-2', controller: 1, gridPos: 2, finalPos: 2, totalLaps: 21,
      totalTime: 277_100, bestLapTime: 9_900, lastLapTime: 12_000, isDNF: true,
      driver: driver('d-2', 'Sandrine FRE'), car: car('c-2', 'Porsche 911'),
    },
  ],
  laps: [
    { id: 'l-1', lapNumber: 1, controller: 0, lapTime: 10_760, sector1: null, sector2: null, sector3: null,
      timestamp: new Date('2026-08-15T12:15:23Z'), driver: driver('d-1', 'Anselme SDR'), car: car('c-1', 'R8 LMS') },
    { id: 'l-2', lapNumber: 1, controller: 1, lapTime: 11_200, sector1: null, sector2: null, sector3: null,
      timestamp: new Date('2026-08-15T12:15:27Z'), driver: driver('d-2', 'Sandrine FRE'), car: car('c-2', 'Porsche 911') },
  ],
  ...overrides,
});

/** Reads a workbook back the way Excel would. */
async function reread(workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buffer);
  return read;
}

const rowValues = (sheet, n) => sheet.getRow(n).values.slice(1);
const findRow = (sheet, label) => {
  let found = null;
  sheet.eachRow((row, n) => {
    if (found === null && row.getCell(1).value === label) found = n;
  });
  return found;
};

describe('export Excel', () => {
  describe('classeur d\'une session', () => {
    let workbook;

    beforeAll(async () => {
      workbook = await reread(buildSessionWorkbook(session()));
    });

    it('regroupe la référence sur une page, puis la session', () => {
      expect(workbook.worksheets.map((s) => s.name)).toEqual(['Référence', '14h00']);
    });

    it('ne liste que les entités réellement engagées', () => {
      const sheet = workbook.getWorksheet('Référence');
      const pilotes = findRow(sheet, 'Pilotes');

      // Deux engagés, donc deux lignes entre l'en-tête et le tableau suivant
      expect(rowValues(sheet, pilotes + 3)[0]).toBe('Anselme SDR');
      expect(rowValues(sheet, pilotes + 4)[0]).toBe('Sandrine FRE');
      expect(findRow(sheet, 'Voitures')).toBe(pilotes + 6);
    });

    /**
     * Les compteurs du modèle valent zéro pour tout le monde : ce qui est
     * compté doit l'être sur ce que le classeur contient.
     */
    it('compte les statistiques sur le périmètre exporté', () => {
      const sheet = workbook.getWorksheet('Référence');
      const first = rowValues(sheet, findRow(sheet, 'Pilotes') + 3);

      expect(first[4]).toBe(1); // sessions
      expect(first[5]).toBe(1); // courses
      expect(first[6]).toBe(1); // victoires
      expect(first[10]).toBe(26); // tours
    });

    it('ne compte aucune course quand la session est une qualification', async () => {
      const quali = await reread(buildSessionWorkbook(session({ type: SessionType.QUALIF })));
      const sheet = quali.getWorksheet('Référence');
      const first = rowValues(sheet, findRow(sheet, 'Pilotes') + 3);

      expect(first[5]).toBe(0); // courses
      expect(first[6]).toBe(0); // victoires
      expect(first[10]).toBe(26); // les tours restent comptés
    });

    it('compte les abandons', () => {
      const sheet = workbook.getWorksheet('Référence');
      const second = rowValues(sheet, findRow(sheet, 'Pilotes') + 4);

      expect(second[8]).toBe(1);
    });

    it('retient le meilleur tour du circuit et son auteur', () => {
      const sheet = workbook.getWorksheet('Référence');
      const circuit = rowValues(sheet, findRow(sheet, 'Circuits') + 3);

      expect(circuit[7]).toBe('Anselme SDR');
      expect(circuit[8]).toBe('Audi R8 LMS');
    });

    it('écrit les réglages en niveaux, pas en pourcentage', () => {
      const sheet = workbook.getWorksheet('14h00');
      const first = rowValues(sheet, findRow(sheet, 'Engagements') + 3);

      expect(first.slice(3, 6)).toEqual(['7/10', '6/10', '10/10']);
    });

    it('classe les engagements par rang de départ', () => {
      const sheet = workbook.getWorksheet('14h00');
      const start = findRow(sheet, 'Engagements') + 3;

      expect(rowValues(sheet, start)[1]).toBe('Anselme SDR');
      expect(rowValues(sheet, start + 1)[1]).toBe('Sandrine FRE');
    });

    it('numérote les manettes à partir de 1, comme sur la Control Unit', () => {
      const sheet = workbook.getWorksheet('14h00');
      const start = findRow(sheet, 'Engagements') + 3;

      expect(rowValues(sheet, start)[0]).toBe(1);
      expect(rowValues(sheet, start + 1)[0]).toBe(2);
    });

    it('marque les DNF', () => {
      const sheet = workbook.getWorksheet('14h00');
      const start = findRow(sheet, 'Engagements') + 3;

      expect(rowValues(sheet, start)[12]).toBeFalsy();
      expect(rowValues(sheet, start + 1)[12]).toBe('oui');
    });

    it('horodate les tours au millième, deux voitures pouvant passer la même seconde', () => {
      const sheet = workbook.getWorksheet('14h00');
      const cell = sheet.getRow(findRow(sheet, 'Tours') + 3).getCell(9);

      expect(cell.numFmt).toBe('dd/mm/yyyy hh:mm:ss.000');
      expect(cell.value.getMilliseconds()).toBe(0 + new Date('2026-08-15T12:15:23Z').getMilliseconds());
    });

    it('reprend tous les tours', () => {
      const sheet = workbook.getWorksheet('14h00');
      const start = findRow(sheet, 'Tours') + 2;

      expect(rowValues(sheet, start + 1)[4]).toBeTruthy();
      expect(rowValues(sheet, start + 2)[4]).toBeTruthy();
    });
  });

  describe('temps', () => {
    let sheet;

    beforeAll(async () => {
      const workbook = await reread(buildSessionWorkbook(session()));
      sheet = workbook.getWorksheet('14h00');
    });

    /**
     * Le temps est une vraie durée Excel — une fraction de jour — donc triable
     * et calculable, et le format le rend lisible en 0:09.356.
     */
    it('écrit une durée exploitable et non du texte', () => {
      const cell = sheet.getRow(findRow(sheet, 'Engagements') + 3).getCell(11);
      const asNumber = cell.value instanceof Date
        ? (cell.value.getTime() - Date.UTC(1899, 11, 30)) / MS_PER_DAY
        : cell.value;

      expect(asNumber).toBeCloseTo(9_356 / MS_PER_DAY, 10);
    });

    it('affiche les durées en minutes:secondes.millisecondes', () => {
      const cell = sheet.getRow(findRow(sheet, 'Engagements') + 3).getCell(11);

      expect(cell.numFmt).toBe('[m]:ss.000');
    });

    /**
     * Les deux tableaux d'une feuille partagent les mêmes colonnes : un format
     * posé sur la colonne entière transformait le nombre de tours en date.
     */
    it('laisse le nombre de tours en nombre entier', () => {
      const cell = sheet.getRow(findRow(sheet, 'Engagements') + 3).getCell(9);

      expect(cell.value).toBe(26);
      expect(cell.numFmt).toBeUndefined();
    });

    it('laisse vide un temps absent plutôt que d\'écrire zéro', async () => {
      const sans = session({ drivers: [{ ...session().drivers[0], bestLapTime: null, totalTime: 0 }] });
      const workbook = await reread(buildSessionWorkbook(sans));
      const feuille = workbook.getWorksheet('14h00');
      const row = feuille.getRow(findRow(feuille, 'Engagements') + 3);

      expect(row.getCell(10).value).toBeNull();
      expect(row.getCell(11).value).toBeNull();
    });
  });

  describe('classeur d\'un championnat', () => {
    const championship = {
      id: 'champ-1', name: 'RING RUSH', season: '2026', status: 'finished',
      mode: 'auto', driversPerQualif: 4, driversPerRace: 4,
      qualifMaxLaps: null, raceMaxLaps: null, track,
      participants: [{ driver: driver('d-1', 'Anselme SDR') }],
      sessions: [session(), session({ id: 'session-2', name: '14h10' })],
    };

    it('ouvre sur le championnat puis enchaîne ses sessions', async () => {
      const workbook = await reread(buildChampionshipWorkbook(championship));

      expect(workbook.worksheets.map((s) => s.name))
        .toEqual(['Référence', 'RING RUSH', '14h00', '14h10']);
    });

    it('cumule les statistiques d\'un pilote sur toutes les sessions', async () => {
      const workbook = await reread(buildChampionshipWorkbook(championship));
      const sheet = workbook.getWorksheet('Référence');
      const first = rowValues(sheet, findRow(sheet, 'Pilotes') + 3);

      expect(first[0]).toBe('Anselme SDR');
      expect(first[4]).toBe(2); // deux sessions, une seule ligne
      expect(first[6]).toBe(2); // deux victoires
      expect(first[10]).toBe(52); // 26 tours par course
    });

    it('distingue deux sessions de même nom', async () => {
      const workbook = await reread(buildChampionshipWorkbook({
        ...championship,
        sessions: [session(), session({ id: 'session-2' })],
      }));

      expect(workbook.worksheets.map((s) => s.name)).toContain('14h00');
      expect(workbook.worksheets.map((s) => s.name)).toContain('14h00 (2)');
    });
  });

  describe('nom de fichier', () => {
    it('est daté, sans accent ni caractère interdit', () => {
      expect(exportFileName('Autodrome du Warndt — Manche 3'))
        .toMatch(/^\d{4}-\d{2}-\d{2}_autodrome-du-warndt-manche-3\.xlsx$/);
    });

    it('reste valide quand le nom est vide', () => {
      expect(exportFileName('')).toMatch(/^\d{4}-\d{2}-\d{2}_export\.xlsx$/);
    });
  });
});

describe('présentation', () => {
  let workbook;

  beforeAll(async () => {
    workbook = await reread(buildSessionWorkbook(session()));
  });

  it('donne un en-tête lisible à chaque tableau', () => {
    const sheet = workbook.getWorksheet('14h00');
    const header = sheet.getRow(findRow(sheet, 'Engagements') + 2);

    expect(header.getCell(1).font.bold).toBe(true);
    expect(header.getCell(1).fill.fgColor.argb).toBe('FF1B2A41');
  });

  it('met le vainqueur en évidence', () => {
    const sheet = workbook.getWorksheet('14h00');
    const first = sheet.getRow(findRow(sheet, 'Engagements') + 3);

    expect(first.getCell(1).fill.fgColor.argb).toBe('FFFFF4CC');
    expect(first.getCell(1).font.bold).toBe(true);
  });

  it('teinte l\'onglet selon le type de session', () => {
    expect(workbook.getWorksheet('14h00').properties.tabColor.argb).toBe('FF16A34A');
  });

  it('masque le quadrillage, les bordures des tableaux suffisent', () => {
    expect(workbook.getWorksheet('14h00').views[0].showGridLines).toBe(false);
  });

  it('indique la version de l\'application, la Control Unit ne la donnant pas toujours', () => {
    const sheet = workbook.getWorksheet('14h00');

    expect(rowValues(sheet, findRow(sheet, 'Version RaceHubOS'))[1]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(rowValues(sheet, findRow(sheet, 'Version Control Unit'))[1]).toBe('5331');
  });

  it('dit clairement quand la Control Unit n\'a pas donné sa version', async () => {
    const sans = await reread(buildSessionWorkbook(session({ cuVersion: null })));
    const sheet = sans.getWorksheet('14h00');

    expect(rowValues(sheet, findRow(sheet, 'Version Control Unit'))[1]).toBe('non communiquée');
  });

  it('affiche la couleur d\'un pilote plutôt que son code hexadécimal', () => {
    const sheet = workbook.getWorksheet('Référence');
    const cell = sheet.getRow(findRow(sheet, 'Pilotes') + 3).getCell(4);

    expect(cell.fill.fgColor.argb).toBe('FFFF0000');
  });
});

describe('informations manquantes', () => {
  const championship = {
    id: 'c', name: 'RING RUSH', season: '2026', status: 'finished', mode: 'manual',
    track, participants: [], // jamais renseignés en mode manuel
    driversPerQualif: null, raceMaxDuration: null, raceMaxLaps: null,
    sessions: [session(), session({ id: 's2', name: '14h10' })],
  };

  /** Les réglages ne sont saisis qu'en mode automatique ; en manuel ils vivent sur les sessions. */
  it('déduit la durée de course des sessions quand le championnat ne la déclare pas', async () => {
    const workbook = await reread(buildChampionshipWorkbook(championship));
    const sheet = workbook.getWorksheet('RING RUSH');

    expect(findRow(sheet, 'Durée de course')).not.toBeNull();
  });

  it('liste les pilotes ayant couru quand aucun participant n\'est déclaré', async () => {
    const workbook = await reread(buildChampionshipWorkbook(championship));
    const sheet = workbook.getWorksheet('RING RUSH');
    const row = findRow(sheet, 'Participants (2)');

    expect(rowValues(sheet, row)[1]).toBe('Anselme SDR, Sandrine FRE');
  });

  it('omet une ligne sans valeur plutôt que de l\'afficher vide', async () => {
    const workbook = await reread(buildChampionshipWorkbook(championship));
    const sheet = workbook.getWorksheet('RING RUSH');

    expect(findRow(sheet, 'Pilotes par qualification')).toBeNull();
  });

  it('garde une ligne dont la valeur est zéro, qui dit qu\'il n\'y en a eu aucune', async () => {
    const workbook = await reread(buildChampionshipWorkbook(championship));
    const sheet = workbook.getWorksheet('RING RUSH');

    expect(rowValues(sheet, findRow(sheet, 'dont qualifications'))[1]).toBe(0);
  });
});

describe('sélection dans une liste', () => {
  const championship = (id, name) => ({
    id, name, season: '2026', status: 'finished', mode: 'manual', track,
    participants: [], sessions: [session({ id: `${id}-s`, name: `${name} course` })],
  });

  it('réunit plusieurs sessions dans un classeur, avec une seule page de référence', async () => {
    const workbook = await reread(buildSessionsWorkbook([
      session({ id: 's1', name: 'Course 1' }),
      session({ id: 's2', name: 'Course 2' }),
    ]));

    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Référence', 'Course 1', 'Course 2']);
  });

  it('cumule les statistiques sur les sessions choisies', async () => {
    const workbook = await reread(buildSessionsWorkbook([
      session({ id: 's1', name: 'Course 1' }),
      session({ id: 's2', name: 'Course 2' }),
    ]));
    const sheet = workbook.getWorksheet('Référence');

    expect(rowValues(sheet, findRow(sheet, 'Pilotes') + 3)[4]).toBe(2);
  });

  it('donne une page à chaque championnat sélectionné', async () => {
    const workbook = await reread(buildChampionshipsWorkbook([
      championship('c1', 'RING RUSH'),
      championship('c2', 'FINALE C200'),
    ]));

    // Chaque championnat est suivi de ses propres sessions : autrement, deux
    // championnats exportés ensemble voient leurs courses s'entremêler derrière eux
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Référence',
      'RING RUSH', 'RING RUSH course',
      'FINALE C200', 'FINALE C200 course',
    ]);
  });

  it('nomme le fichier selon le nombre d\'éléments', () => {
    expect(exportFileName('3-sessions')).toMatch(/_3-sessions\.xlsx$/);
  });
});

describe('classement par championnat', () => {
  const withWinner = (id, name, winner) => ({
    id, name, season: '2026', status: 'finished', mode: 'manual', track, participants: [],
    sessions: [session({
      id: `${id}-s`,
      name: `${name} course`,
      drivers: [
        { ...session().drivers[0], finalPos: winner === 'a' ? 1 : 2 },
        { ...session().drivers[1], finalPos: winner === 'a' ? 2 : 1, isDNF: false },
      ],
    })],
  });

  /**
   * La feuille Référence cumule tout l'export : elle ne dit pas qui a gagné
   * quoi dans quel championnat.
   */
  it('donne à chaque championnat son propre classement', async () => {
    const workbook = await reread(buildChampionshipsWorkbook([
      withWinner('c1', 'RING RUSH', 'a'),
      withWinner('c2', 'FINALE C200', 'b'),
    ]));

    const ring = workbook.getWorksheet('RING RUSH');
    const finale = workbook.getWorksheet('FINALE C200');

    expect(rowValues(ring, findRow(ring, 'Classement pilotes') + 3)[0]).toBe('Anselme SDR');
    expect(rowValues(finale, findRow(finale, 'Classement pilotes') + 3)[0]).toBe('Sandrine FRE');
  });

  it('compte les victoires du championnat, pas celles de tout l\'export', async () => {
    const workbook = await reread(buildChampionshipsWorkbook([
      withWinner('c1', 'RING RUSH', 'a'),
      withWinner('c2', 'FINALE C200', 'b'),
    ]));

    const ring = workbook.getWorksheet('RING RUSH');
    const reference = workbook.getWorksheet('Référence');

    expect(rowValues(ring, findRow(ring, 'Classement pilotes') + 3)[6]).toBe(1);
    // Une victoire dans chaque championnat, donc une seule chacun au cumul
    expect(rowValues(reference, findRow(reference, 'Pilotes') + 3)[6]).toBe(1);
    expect(rowValues(ring, findRow(ring, 'Classement pilotes') + 3)[10]).toBe(26);
    expect(rowValues(reference, findRow(reference, 'Pilotes') + 3)[10]).toBe(52);
  });

  it('classe le meilleur en premier', async () => {
    const workbook = await reread(buildChampionshipWorkbook({
      id: 'c', name: 'RING RUSH', season: '2026', status: 'finished', mode: 'manual',
      track, participants: [],
      sessions: [session({ drivers: [
        { ...session().drivers[0], finalPos: 2 },
        { ...session().drivers[1], finalPos: 1, isDNF: false },
      ] })],
    }));
    const sheet = workbook.getWorksheet('RING RUSH');

    expect(rowValues(sheet, findRow(sheet, 'Classement pilotes') + 3)[0]).toBe('Sandrine FRE');
  });
});

describe('caractéristiques des voitures engagées', () => {
  const equipped = { ...car('c-1', 'R8 LMS'), motor: 'Mabuchi S-Can', weightGrams: 82 };

  it('ajoute une colonne par caractéristique renseignée', async () => {
    const withSpecs = session({
      drivers: [{ ...session().drivers[0], car: equipped }],
      laps: [],
    });
    const workbook = await reread(buildSessionWorkbook(withSpecs));
    const sheet = workbook.getWorksheet('14h00');
    const header = rowValues(sheet, findRow(sheet, 'Engagements') + 2);

    expect(header).toContain('Moteur');
    expect(header).toContain('Poids (g)');
    expect(header).not.toContain('Châssis');
  });

  it('donne la valeur de la voiture engagée', async () => {
    const withSpecs = session({
      drivers: [{ ...session().drivers[0], car: equipped }],
      laps: [],
    });
    const workbook = await reread(buildSessionWorkbook(withSpecs));
    const sheet = workbook.getWorksheet('14h00');
    const header = rowValues(sheet, findRow(sheet, 'Engagements') + 2);
    const row = rowValues(sheet, findRow(sheet, 'Engagements') + 3);

    expect(row[header.indexOf('Moteur')]).toBe('Mabuchi S-Can');
    expect(row[header.indexOf('Poids (g)')]).toBe(82);
  });

  /** Sinon dix-sept colonnes vides sur chaque feuille de session. */
  it('n\'ajoute aucune colonne quand rien n\'est renseigné', async () => {
    const workbook = await reread(buildSessionWorkbook(session()));
    const sheet = workbook.getWorksheet('14h00');
    const header = rowValues(sheet, findRow(sheet, 'Engagements') + 2);

    expect(header[header.length - 1]).toBe('Abandon');
  });
});
