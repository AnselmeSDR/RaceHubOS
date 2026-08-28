/**
 * Replay the soft-delete cascades on entities deleted before cascades existed.
 *
 * Deleting a track used to mark only the track: its championships, sessions,
 * laps and records stayed active and kept showing up in the statistics. This
 * reuses each entity's own deletion timestamp, so restoring it later brings
 * back exactly what this pass hid.
 *
 * Usage:
 *   node scripts/replay-cascades.js           # report only, changes nothing
 *   node scripts/replay-cascades.js --apply   # apply, after a backup
 */
import 'dotenv/config';
import { createPrismaClient } from '../src/lib/prisma.js';
import { backupDatabase } from '../src/lib/backupDatabase.js';

const apply = process.argv.includes('--apply');
const prisma = createPrismaClient();
const active = { deletedAt: null };

/** Mark rows still active under an already-deleted parent, using its timestamp. */
async function cascadeFor(label, deletedParents, childUpdates) {
  let total = 0;
  for (const parent of deletedParents) {
    for (const [table, where] of childUpdates(parent)) {
      const count = apply
        ? (await prisma[table].updateMany({ where: { ...where, ...active }, data: { deletedAt: parent.deletedAt } })).count
        : await prisma[table].count({ where: { ...where, ...active } });
      total += count;
      if (count) console.log(`  ${label.padEnd(22)} ${parent.id.slice(0, 8)} → ${count} ${table}`);
    }
  }
  return total;
}

// Car has no `name`, so only the shared columns are selected
const deleted = (model) =>
  prisma[model].findMany({ where: { deletedAt: { not: null } }, select: { id: true, deletedAt: true } });

console.log(apply ? '\n▶ Application des cascades\n' : '\n▶ Simulation (aucune modification)\n');

if (apply) {
  const path = backupDatabase({ reason: 'replay-cascades' });
  if (path) console.log(`💾 Sauvegarde: ${path}\n`);
}

let total = 0;

// Tracks first: they own championships and sessions
const tracks = await deleted('track');
total += await cascadeFor('circuit', tracks, (t) => [
  ['championship', { trackId: t.id }],
  ['session', { trackId: t.id }],
  ['lap', { trackId: t.id }],
  ['trackRecord', { trackId: t.id }],
]);

const championships = await deleted('championship');
total += await cascadeFor('championnat', championships, (c) => [
  ['session', { championshipId: c.id }],
  ['championshipParticipant', { championshipId: c.id }],
]);

const sessions = await deleted('session');
total += await cascadeFor('session', sessions, (s) => [
  ['lap', { sessionId: s.id }],
  ['sessionDriver', { sessionId: s.id }],
  ['trackRecord', { sessionId: s.id }],
]);

const drivers = await deleted('driver');
total += await cascadeFor('pilote', drivers, (d) => [
  ['lap', { driverId: d.id }],
  ['sessionDriver', { driverId: d.id }],
  ['trackRecord', { driverId: d.id }],
  ['championshipParticipant', { driverId: d.id }],
]);

const cars = await deleted('car');
total += await cascadeFor('voiture', cars, (c) => [
  ['lap', { carId: c.id }],
  ['sessionDriver', { carId: c.id }],
  ['trackRecord', { carId: c.id }],
]);

console.log(
  total === 0
    ? '\n✅ Rien à rattraper : toutes les cascades sont à jour.\n'
    : apply
      ? `\n✅ ${total} ligne(s) masquée(s).\n`
      : `\n${total} ligne(s) seraient masquées. Relancer avec --apply pour appliquer.\n`
);

await prisma.$disconnect();
