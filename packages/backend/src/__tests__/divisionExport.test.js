import ExcelJS from 'exceljs';
import { ChampionshipStatus } from '@racehubos/shared';
import { buildDivisionsWorkbook } from '../lib/divisionExport.js';

const gold = { id: 'gold', name: 'GOLD', shortName: 'GLD', scope: 'driver', order: 2, color: '#F5D13C' };
const invite = { id: 'invite', name: 'INVITÉ', scope: 'driver' };
const gt3 = { id: 'gt3', name: 'GT3', scope: 'car', order: 1, color: '#E11D48' };
const since = '2026-11-12T10:00:00.000Z';

const divisions = [
  {
    ...gold,
    drivers: [
      {
        name: 'Ana',
        number: 7,
        since,
        divisions: [gold, invite],
        wins: 3,
        podiums: 5,
        bestLap: 8123,
        races: 12,
      },
    ],
    cars: [],
    championships: [{ name: 'Cup', season: '2026', status: ChampionshipStatus.ACTIVE, track: { name: 'Monza' } }],
  },
  {
    ...gt3,
    drivers: [],
    cars: [{ brand: 'Audi', model: 'R8', year: 2019, since, divisions: [gt3] }],
    championships: [],
  },
];

async function reread(workbook) {
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(await workbook.xlsx.writeBuffer());
  return read;
}
const rows = (sheet) => Array.from(sheet.getSheetValues(), (row) => row?.slice(1) ?? []);
const rowAfter = (sheet, heading, offset) => rows(sheet)[rows(sheet).findIndex((r) => r[0] === heading) + offset];

describe('export of divisions', () => {
  let workbook;
  beforeAll(async () => {
    workbook = await reread(buildDivisionsWorkbook(divisions));
  });

  test('one sheet per division, then the links', () => {
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['GOLD', 'GT3', 'Liens']);
  });

  test('a division: its kind and rank, its drivers with their other divisions and figures, its championships', () => {
    const sheet = workbook.getWorksheet('GOLD');
    expect(rows(sheet).find((r) => r[0] === 'Type')[1]).toBe('Division de pilotes');
    expect(rows(sheet).find((r) => r[0] === 'Échelon')[1]).toBe(2);
    expect(rowAfter(sheet, 'Pilotes (1)', 3)).toEqual(expect.arrayContaining(['Ana', 7, 'INVITÉ', 12, 3, 5]));
    expect(rowAfter(sheet, 'Championnats (1)', 3)).toEqual(['Cup', 'Monza', '2026', 'en cours']);
  });

  test('a category lists its cars by order', () => {
    const sheet = workbook.getWorksheet('GT3');
    expect(rows(sheet).find((r) => r[0] === 'Ordre')[1]).toBe(1);
    expect(rowAfter(sheet, 'Voitures (1)', 3).slice(0, 2)).toEqual(['Audi R8', 2019]);
  });

  test('every link: division, kind, member, since when', () => {
    const sheet = workbook.getWorksheet('Liens');
    expect(rowAfter(sheet, 'Liens (2)', 3).slice(0, 3)).toEqual(['GOLD', 'Division de pilotes', 'Ana']);
    expect(rowAfter(sheet, 'Liens (2)', 4).slice(0, 3)).toEqual(['GT3', 'Catégorie de voitures', 'Audi R8']);
    expect(rowAfter(sheet, 'Liens (2)', 3)[3]).toEqual(new Date(since));
  });
});
