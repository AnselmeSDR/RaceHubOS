/**
 * Standalone database backup: `node scripts/backup-db.js [reason]`
 * Used by the Windows installer before it touches an existing install.
 */
import 'dotenv/config';
import { backupDatabase } from '../src/lib/backupDatabase.js';

const reason = process.argv[2] || 'manual';

try {
  const target = backupDatabase({ reason });
  console.log(target ? `💾 Sauvegarde: ${target}` : 'ℹ️  Aucune base à sauvegarder');
} catch (err) {
  console.error('⚠️  Sauvegarde impossible:', err.message);
  process.exit(1);
}
