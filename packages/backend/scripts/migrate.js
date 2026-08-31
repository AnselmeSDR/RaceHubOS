#!/usr/bin/env node
/**
 * Applies pending migrations, baselining a database that predates them.
 *
 * Kept as a CLI so the update route can run it without blocking the event loop
 * (migrateSchema drives prisma synchronously).
 */
import { migrateSchema } from '../src/lib/migrateSchema.js';

try {
  const { baselined } = migrateSchema();
  if (baselined.length) {
    console.log(`${baselined.length} migration(s) marquée(s) comme déjà appliquées (base antérieure aux migrations)`);
  }
  console.log('✅ Schéma à jour');
} catch (err) {
  console.error('❌ Migration échouée:', err.message);
  process.exit(1);
}
