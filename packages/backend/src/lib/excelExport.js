import { newWorkbook } from './excel/format.js';
import { addChampionshipSheet, addReferenceSheet, addSessionSheet } from './excel/sessionSheets.js';

/**
 * Excel export of sessions and championships: an overview of everything exported, then each
 * championship followed by its own sessions. The sheets themselves live in `excel/`.
 */

/**
 * Sheet order: the overview first, then each championship immediately followed
 * by its own sessions. Grouping matters as soon as two championships are
 * exported together — otherwise their races end up interleaved behind them, and
 * nothing says which race belonged to which championship.
 */
function buildWorkbook(sessions, championships = []) {
  const workbook = newWorkbook();
  addReferenceSheet(workbook, sessions);
  const taken = new Set(['Référence']);

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
    if (!written.has(session.id)) addSessionSheet(workbook, session, taken);
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
  return buildWorkbook(
    championships.flatMap((c) => c.sessions ?? []),
    championships
  );
}

/** Safe file name for a browser download. */
export function exportFileName(label) {
  const date = new Date().toISOString().slice(0, 10);
  const slug =
    (label || 'export')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'export';
  return `${date}_${slug}.xlsx`;
}
