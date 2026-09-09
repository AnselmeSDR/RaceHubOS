import ExcelJS from 'exceljs';
import { SessionType } from '@racehubos/shared';
import { buildCarWorkbook, buildCarsWorkbook, buildDriverWorkbook, buildDriversWorkbook } from '../lib/entityExport.js';

const track = (id, name) => ({ id, name });
const car = (id, model) => ({ id, brand: 'Audi', model, year: 2024, color: '#0f0', maxSpeed: 70, brakeForce: 60, fuelCapacity: 100 });

/** One entry: a driver in a session, with the result already summarised. */
const entry = (over = {}) => ({
  id: `sd-${over.id ?? 1}`,
  controller: 0,
  carId: 'c-1',
  driverId: 'd-1',
  gridPos: 1,
  finalPos: 1,
  totalLaps: 26,
  totalTime: 277_394,
  bestLapTime: 9_356,
  isDNF: false,
  car: car('c-1', 'R8 LMS'),
  driver: { id: 'd-1', name: 'Anselme SDR' },
  session: {
    id: 's-1',
    name: '14h00',
    type: SessionType.RACE,
    trackId: 't-1',
    championshipId: 'ch-1',
    track: track('t-1', 'Creutzwald Ring'),
    championship: { id: 'ch-1', name: 'RING RUSH' },
    startedAt: new Date('2026-08-15T12:15:13Z'),
    createdAt: new Date('2026-08-15T12:00:00Z'),
  },
  ...over,
});

const driver = (entries) => ({ id: 'd-1', name: 'Anselme SDR', number: 42, team: { name: 'SILVER' }, sessions: entries });

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
const fieldValue = (sheet, label) => rowValues(sheet, findRow(sheet, label))[1];

/**
 * Un pilote peut compter cent sessions : le classeur donne son palmarès, puis
 * une ligne par session — jamais le détail de chacune.
 */
describe('export d\'un pilote', () => {
  const entries = [
    entry({ id: 1 }),
    entry({ id: 2, finalPos: 3, bestLapTime: 9_900, session: { ...entry().session, id: 's-2', name: '14h10' } }),
    entry({ id: 3, finalPos: null, session: { ...entry().session, id: 's-3', name: 'Q1', type: SessionType.QUALIF } }),
  ];
  let workbook;

  beforeAll(async () => {
    workbook = await reread(buildDriverWorkbook(driver(entries)));
  });

  it('donne une feuille au pilote et une liste de ses sessions', () => {
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Anselme SDR', 'Sessions']);
  });

  it('résume son palmarès', () => {
    const sheet = workbook.getWorksheet('Anselme SDR');

    expect(fieldValue(sheet, 'Sessions')).toBe(3);
    expect(fieldValue(sheet, 'dont courses')).toBe(2);
    expect(fieldValue(sheet, 'dont qualifications')).toBe(1);
    expect(fieldValue(sheet, 'Victoires')).toBe(1);
    expect(fieldValue(sheet, 'Podiums')).toBe(2);
    expect(fieldValue(sheet, 'Championnats')).toBe(1);
    expect(fieldValue(sheet, 'Tours')).toBe(78);
  });

  it('dit où et quand son meilleur tour a été signé', () => {
    const sheet = workbook.getWorksheet('Anselme SDR');

    expect(fieldValue(sheet, 'signé sur')).toBe('Creutzwald Ring');
  });

  it('ventile par championnat, circuit et voiture', () => {
    const sheet = workbook.getWorksheet('Anselme SDR');

    expect(findRow(sheet, 'Par championnat')).not.toBeNull();
    expect(findRow(sheet, 'Par circuit')).not.toBeNull();
    expect(findRow(sheet, 'Par voiture')).not.toBeNull();
    expect(rowValues(sheet, findRow(sheet, 'Par championnat') + 3)[0]).toBe('RING RUSH');
  });

  it('liste chaque session sans en détailler les tours', () => {
    const sheet = workbook.getWorksheet('Sessions');

    expect(rowValues(sheet, 1)[0]).toBe('Sessions (3)');
    // Le plus récent d'abord ; toutes partagent la date, l'ordre reste stable
    expect(sheet.rowCount).toBe(6); // titre, vide, en-tête, 3 sessions
  });

  it('donne pour chaque session son circuit, sa voiture et son résultat', () => {
    const sheet = workbook.getWorksheet('Sessions');
    const header = rowValues(sheet, 3);

    expect(header).toContain('Circuit');
    expect(header).toContain('Voiture');
    expect(header).toContain('Arrivée');
    expect(header).toContain('Meilleur tour');
  });

  it('sépare les sessions hors championnat', async () => {
    const orphan = entry({ id: 4, session: { ...entry().session, id: 's-4', championshipId: null, championship: null } });
    const solo = await reread(buildDriverWorkbook(driver([...entries, orphan])));
    const sheet = solo.getWorksheet('Anselme SDR');
    const rows = [];
    sheet.eachRow((row, n) => {
      if (n > findRow(sheet, 'Par championnat') + 2 && n < findRow(sheet, 'Par circuit')) {
        if (row.getCell(1).value) rows.push(row.getCell(1).value);
      }
    });

    expect(rows).toContain('Hors championnat');
  });
});

describe('export d\'une voiture', () => {
  const carEntries = [entry({ id: 1 }), entry({ id: 2, driverId: 'd-2', driver: { id: 'd-2', name: 'Romain DAN' } })];

  it('ventile par pilote plutôt que par voiture', async () => {
    const workbook = await reread(buildCarWorkbook({ ...car('c-1', 'R8 LMS'), sessions: carEntries }));
    const sheet = workbook.getWorksheet('Audi R8 LMS');

    expect(findRow(sheet, 'Par pilote')).not.toBeNull();
    expect(findRow(sheet, 'Par voiture')).toBeNull();
  });

  it('rappelle les réglages de la voiture', async () => {
    const workbook = await reread(buildCarWorkbook({ ...car('c-1', 'R8 LMS'), sessions: carEntries }));
    const sheet = workbook.getWorksheet('Audi R8 LMS');

    expect(fieldValue(sheet, 'Vitesse')).toBe('7/10');
  });
});

describe('sélection de plusieurs pilotes', () => {
  it('donne une feuille à chacun et une seule liste', async () => {
    const workbook = await reread(buildDriversWorkbook([
      driver([entry({ id: 1 })]),
      { id: 'd-2', name: 'Romain DAN', sessions: [entry({ id: 2, driverId: 'd-2' })] },
    ]));

    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Anselme SDR', 'Romain DAN', 'Sessions']);
  });

  /** Sans cette colonne, on ne saurait pas de qui vient chaque ligne. */
  it('ajoute une colonne disant à qui appartient chaque session', async () => {
    const workbook = await reread(buildDriversWorkbook([
      driver([entry({ id: 1 })]),
      { id: 'd-2', name: 'Romain DAN', sessions: [entry({ id: 2, driverId: 'd-2' })] },
    ]));
    const sheet = workbook.getWorksheet('Sessions');

    expect(rowValues(sheet, 3)[0]).toBe('Pilote');
    expect(rowValues(sheet, 4)[0]).toBe('Anselme SDR');
  });

  it('n\'ajoute pas cette colonne pour un seul pilote', async () => {
    const workbook = await reread(buildDriverWorkbook(driver([entry({ id: 1 })])));
    const sheet = workbook.getWorksheet('Sessions');

    expect(rowValues(sheet, 3)[0]).toBe('Date');
  });

  it('distingue deux voitures de même nom', async () => {
    const workbook = await reread(buildCarsWorkbook([
      { ...car('c-1', 'R8 LMS'), sessions: [] },
      { ...car('c-2', 'R8 LMS'), sessions: [] },
    ]));

    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Audi R8 LMS', 'Audi R8 LMS (2)', 'Sessions']);
  });
});
