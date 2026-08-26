/**
 * Repair / re-run an update outside the app — used by the launchers when
 * RaceHubOS fails to start (half-applied update, broken dependencies,
 * failed migration). The app itself cannot offer this: it is not running.
 *
 * Usage: npm run repair
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(rootDir, 'packages/backend');

const steps = [
  ['Récupération de la dernière version', 'git fetch origin main', rootDir, true],
  ['Nettoyage des modifications locales', 'git checkout -- .', rootDir, true],
  ['Application de la mise à jour', 'git pull origin main --ff-only', rootDir, true],
  ['Installation des dépendances', 'npm install --legacy-peer-deps', rootDir, false],
  ['Build du frontend', 'npm run build', rootDir, false],
  ['Sauvegarde de la base', 'node scripts/backup-db.js repair', backendDir, true],
  ['Génération du client Prisma', 'npx prisma generate', backendDir, false],
  ['Migration de la base', 'npx prisma db push --accept-data-loss', backendDir, false],
];

console.log('\n🔧 Réparation de RaceHubOS\n');

for (const [label, command, cwd, optional] of steps) {
  process.stdout.write(`→ ${label}...\n`);
  try {
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (err) {
    if (optional) {
      console.warn(`⚠️  ${label} : ignoré (${err.message.split('\n')[0]})`);
      continue;
    }
    console.error(`\n❌ Échec : ${label}`);
    console.error(`   Commande : ${command}`);
    console.error('\nLa réparation n\'a pas abouti. Relancez l\'installeur RaceHubOS.\n');
    process.exit(1);
  }
}

console.log('\n✅ Réparation terminée. RaceHubOS va redémarrer.\n');
