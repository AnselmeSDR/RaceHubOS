/**
 * Startup script: runs prisma generate + conditional db push (only after version change)
 * Used by `npm start` to ensure schema is in sync after an update.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '..');
const rootDir = path.join(backendDir, '../..');
const versionFile = path.join(backendDir, 'prisma', '.version');

const currentVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version;
const lastVersion = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf-8').trim() : null;

const run = (cmd) => execSync(cmd, { cwd: backendDir, stdio: 'inherit' });

// Always run prisma generate (fast, idempotent, fixes Windows DLL after update)
console.log('⚙️  Prisma generate...');
run('npx prisma generate');

if (lastVersion !== currentVersion) {
  console.log(`📦 Version changed: ${lastVersion || 'none'} → ${currentVersion}`);
  console.log('⚙️  Prisma db push...');
  try {
    run('npx prisma db push --skip-generate --accept-data-loss');
  } catch (err) {
    console.error('⚠️  db push failed (non-blocking):', err.message);
  }
  fs.writeFileSync(versionFile, currentVersion);
} else {
  console.log(`✅ Version ${currentVersion} — schema à jour`);
}
