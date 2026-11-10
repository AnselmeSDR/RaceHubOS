// `npm run dev`: the backend, started again when its code changes or when it asks for a restart (exit 42)
import path from 'node:path';
import { devWatchPaths, runDev } from '../src/lib/devRunner.js';

const backendDir = path.resolve(import.meta.dirname, '..');
const rootDir = path.resolve(backendDir, '../..');

const runner = runDev({
  args: ['--import', './src/addons/preload.js', 'src/index.js'],
  watch: () => devWatchPaths(rootDir),
  cwd: backendDir,
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => runner.stop().then(() => process.exit(0)));
