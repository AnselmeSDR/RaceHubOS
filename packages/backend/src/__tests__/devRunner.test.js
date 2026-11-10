import fs from 'fs';
import path from 'path';
import { disableAddon } from '@racehubos/shared/addons';
import { devWatchPaths, RESTART_CODE, runDev } from '../lib/devRunner.js';
import { makeAddon, makeRoot, removeRoot, writeFile } from './helpers/addonFixtures.js';

let root;
let runner;
beforeEach(() => {
  root = makeRoot('racehubos-dev-');
});
afterEach(async () => {
  await runner?.stop();
  runner = null;
  removeRoot(root);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 5000) {
  for (const end = Date.now() + timeout; !check(); await sleep(25)) {
    if (Date.now() > end) throw new Error('timed out');
  }
}

// A server that notes each start, then exits with the code planned for that start, or keeps running
function server(exits = []) {
  const log = path.join(root, 'starts.log');
  const starts = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf-8').trim().split('\n').length : 0);
  const entry = writeFile(
    root,
    'server.mjs',
    [
      "import fs from 'node:fs';",
      `fs.appendFileSync(${JSON.stringify(log)}, 'start\\n');`,
      `const exit = ${JSON.stringify(exits)}[fs.readFileSync(${JSON.stringify(log)}, 'utf-8').trim().split('\\n').length - 1];`,
      'if (exit != null) process.exit(exit);',
      'setInterval(() => {}, 1000);',
    ].join('\n')
  );
  return { entry, starts };
}

const run = (entry, watch) => runDev({ args: [entry], watch, log: () => {} });

test('a server that asks for a restart is started again, one that stops waits for a change', async () => {
  const { entry, starts } = server([RESTART_CODE, 1]);
  fs.mkdirSync(path.join(root, 'src'));
  runner = run(entry, () => [path.join(root, 'src')]);

  await until(() => starts() === 2);
  await sleep(400);
  expect(starts()).toBe(2);

  writeFile(root, 'src/board.js');
  await until(() => starts() === 3);
});

test('a code change restarts the server, other files do not', async () => {
  const { entry, starts } = server();
  fs.mkdirSync(path.join(root, 'src'));
  runner = run(entry, () => [path.join(root, 'src')]);
  await until(() => starts() === 1);

  writeFile(root, 'src/board.test.js');
  writeFile(root, 'src/notes.md');
  writeFile(root, 'src/node_modules/pkg/index.js');
  await sleep(400);
  expect(starts()).toBe(1);

  writeFile(root, 'src/board.js');
  await until(() => starts() === 2);
});

test('watches the core and the server side of the enabled add-ons', async () => {
  fs.mkdirSync(path.join(root, 'packages/backend/src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages/shared/src'), { recursive: true });
  makeAddon(root, 'pits', { files: { 'server/index.js': '', 'web/Page.js': '' } });
  makeAddon(root, 'off', { files: { 'server/index.js': '' } });
  disableAddon(root, 'off');
  const { entry, starts } = server();
  runner = run(entry, () => devWatchPaths(root));
  await until(() => starts() === 1);

  writeFile(root, 'addons/pits/web/Page.js', '// changed');
  writeFile(root, 'addons/off/server/index.js', '// changed');
  await sleep(400);
  expect(starts()).toBe(1);

  writeFile(root, 'addons/pits/server/index.js', '// changed');
  await until(() => starts() === 2);
  writeFile(root, 'packages/shared/src/board.js');
  await until(() => starts() === 3);
});
