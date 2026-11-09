import ExcelJS from 'exceljs';
import { createRequire } from 'module';

/**
 * Sheet building blocks shared by every export.
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
export const TIMESTAMP_FORMAT = 'dd/mm/yyyy hh:mm:ss.000';

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
      cachedVersion = require('../../../../../package.json').version ?? '';
    } catch {
      cachedVersion = '';
    }
  }
  return cachedVersion || 'inconnue';
}

/** An empty workbook signed by this version of RaceHubOS. */
export function newWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `RaceHubOS ${appVersion()}`;
  workbook.lastModifiedBy = workbook.creator;
  workbook.created = new Date();
  return workbook;
}

const rule = { style: 'thin', color: { argb: RULE } };
const border = { top: rule, left: rule, bottom: rule, right: rule };

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** #3b3a38 or #f00 → FF3B3A38, so a colour column can actually be that colour. */
export function toArgb(hex) {
  const clean = String(hex ?? '')
    .replace('#', '')
    .trim();
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `FF${[...clean]
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `FF${clean.toUpperCase()}`;
  return null;
}

/** Milliseconds as an Excel duration, or null when there is no time. */
export const duration = (ms) => (ms == null || ms <= 0 ? null : ms / MS_PER_DAY);

export const asDate = (value) => (value ? new Date(value) : null);

/**
 * A sheet with the presentation settings every sheet shares: no gridlines, so
 * the tables' own borders carry the structure, and a landscape page fitted to
 * the width for anyone who prints it.
 */
export function newSheet(workbook, name, tabColor) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });
  if (tabColor) sheet.properties.tabColor = { argb: tabColor };
  sheet.properties.defaultRowHeight = 16;
  return sheet;
}

/** A sheet name Excel accepts and `taken` doesn't hold yet, which it then holds. */
export const sheetNameOf = (raw, taken) => {
  // Excel refuses : \ / ? * [ ] and anything past 31 characters
  const base =
    (raw || 'Session')
      .replace(/[:\\/?*[\]]/g, ' ')
      .trim()
      .slice(0, 31) || 'Session';
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
      cell.alignment = {
        vertical: 'middle',
        horizontal: column.align ?? (typeof cell.value === 'number' ? 'center' : 'left'),
      };
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

/** Label / value lines, each one left out when it has nothing to say. */
export function addFields(sheet, fields) {
  for (const [label, value, numFmt] of fields) addField(sheet, label, value, numFmt);
}
