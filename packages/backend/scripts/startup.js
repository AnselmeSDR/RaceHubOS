/**
 * Startup script: runs prisma generate + conditional migration (only after version change)
 * Used by `npm start` to ensure schema is in sync after an update.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { backupDatabase } from '../src/lib/backupDatabase.js';
import { migrateSchema } from '../src/lib/migrateSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '..');
const rootDir = path.join(backendDir, '../..');
const versionFile = path.join(backendDir, 'prisma', '.version');

// Exit code telling the launcher the database migration failed
const MIGRATION_FAILED = 43;

const currentVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version;
const lastVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf-8').trim() : null;

const run = (cmd) => execSync(cmd, { cwd: backendDir, stdio: 'inherit' });

// Always run prisma generate (fast, idempotent, fixes Windows DLL after update)
console.log('⚙️  Prisma generate...');
run('npx prisma generate');

if (lastVersion !== currentVersion) {
  console.log(`📦 Version changed: ${lastVersion || 'none'} → ${currentVersion}`);
  try {
    const backupPath = backupDatabase({ reason: 'migration' });
    if (backupPath) console.log(`💾 Sauvegarde avant migration: ${backupPath}`);
  } catch (err) {
    console.error('❌ Sauvegarde de la base impossible; migration annulée:', err.message);
    process.exit(MIGRATION_FAILED);
  }

  console.log('⚙️  Migration de la base...');
  try {
    const { baselined } = migrateSchema();
    if (baselined.length) {
      console.log(`   ${baselined.length} migration(s) marquée(s) comme déjà appliquées (base antérieure aux migrations)`);
    }
    fs.writeFileSync(versionFile, currentVersion);
  } catch (err) {
    console.error('❌ Migration de la base échouée; démarrage interrompu:', err.message);
    // Exit code read by the launcher, which offers to repair instead of
    // starting the app on a schema that does not match the code
    process.exit(MIGRATION_FAILED);
  }
} else {
  console.log(`✅ Version ${currentVersion} — schema à jour`);
}
