#!/usr/bin/env node
/**
 * Points git at the versioned hooks in .githooks/.
 *
 * Runs on every "npm install" (prepare script), so a contributor gets the
 * hooks without doing anything. Silent outside a git clone, so an install
 * from a ZIP never fails because of it.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!fs.existsSync(path.join(rootDir, '.git'))) process.exit(0);

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: rootDir, stdio: 'ignore' });
} catch {
  // Sans git, l'application s'installe quand meme : seuls les hooks manquent
}
