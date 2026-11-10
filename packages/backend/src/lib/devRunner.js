import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { enabledAddons, realPosix } from '@racehubos/shared/addons';

/** The exit code that asks for a restart: an add-on action or an update. The launchers restart on it too. */
export const RESTART_CODE = 42;

const CODE = /\.(c|m)?js$|\.json$/;
const IGNORED = /(^|[\\/])(node_modules|\.git|\.data|coverage|__tests__)([\\/]|$)|\.test\.js$/;

/** The folders whose code restarts the backend: its own, the shared package's, and each enabled add-on's server side. */
export function devWatchPaths(rootDir) {
  const addonParts = ['server', 'overrides/packages/backend', 'overrides/packages/shared'];
  return [
    path.join(rootDir, 'packages/backend/src'),
    path.join(rootDir, 'packages/shared/src'),
    ...enabledAddons(rootDir).flatMap((addon) => addonParts.map((part) => path.join(realPosix(addon.dir), part))),
  ];
}

/**
 * Runs the backend in development. Like `node --watch`, it starts the server again when its code
 * changes. Unlike it, it also starts it again after an exit with RESTART_CODE: `node --watch` waits
 * for a change, and the app stayed down after an add-on action.
 *
 * @param {object} options
 * @param {string[]} options.args node arguments
 * @param {() => string[]} options.watch the folders to watch, read again at each start (an add-on installed meanwhile)
 */
export function runDev({ args, watch, cwd = process.cwd(), delay = 100, log = console.log }) {
  let child = null;
  let watchers = [];
  let timer = null;
  let restarting = false;
  let stopping = false;

  const unwatch = () => {
    watchers.forEach((watcher) => watcher.close());
    watchers = [];
  };

  const restart = () => {
    if (!child) return start();
    restarting = true;
    child.kill('SIGTERM');
  };

  const changed = (event, file) => {
    if (!file || !CODE.test(file) || IGNORED.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(restart, delay);
  };

  function start() {
    unwatch();
    child = spawn(process.execPath, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code, signal) => {
      child = null;
      if (stopping) return;
      if (restarting || code === RESTART_CODE) {
        if (!restarting) log('Restart asked: starting again');
        restarting = false;
        start();
        return;
      }
      log(`Exited with ${code ?? signal}: waiting for a change before starting again`);
    });
    watchers = watch()
      .filter((dir) => fs.existsSync(dir))
      .map((dir) => fs.watch(dir, { recursive: true }, changed));
  }

  start();

  return {
    /** Stops watching and stops the server. */
    stop() {
      stopping = true;
      clearTimeout(timer);
      unwatch();
      if (!child) return Promise.resolve();
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      return exited;
    },
  };
}
