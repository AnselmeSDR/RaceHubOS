import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { addonPaths, disableAddon, enabledAddons, realPosix } from '@racehubos/shared/addons';

const execAsync = promisify(exec);

/** npm goes through a shell (npm.cmd on Windows). Only fixed commands, never user input. */
export function runNpm(command, { cwd, timeout = 300000 } = {}) {
  return execAsync(command, { cwd, timeout, maxBuffer: 20 * 1024 * 1024 });
}

/** Whether a build output names one of the add-on's files. */
export function blames(output, addon, addonsDir) {
  const text = output.replaceAll('\\', '/');
  return text.includes(`${path.basename(addonsDir)}/${addon.id}/`) || text.includes(`${realPosix(addon.dir)}/`);
}

/** The line to show the user: the first one mentioning an error, or the first one. */
export function errorSummary(output) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines.find((line) => /error/i.test(line)) ?? lines[0] ?? 'unknown error').slice(0, 300);
}

/**
 * Builds the app. When the build fails on an add-on file, that add-on is disabled and the
 * build retried: a broken add-on never blocks the core — docs/ADDONS.md § When something breaks.
 *
 * @returns {Promise<{ disabled: string[] }>} the add-ons disabled on the way
 * @throws the build error when no enabled add-on is to blame
 */
export async function buildApp(rootDir, { npm = runNpm, log = console } = {}) {
  const { addonsDir } = addonPaths(rootDir);
  const disabled = [];
  for (;;) {
    try {
      await npm('npm run build', { cwd: rootDir });
      return { disabled };
    } catch (error) {
      const output = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
      const culprit = enabledAddons(rootDir).find((addon) => blames(output, addon, addonsDir));
      if (!culprit) throw error;
      const reason = `build failed: ${errorSummary(output)}`;
      log.error(`[addons] ${culprit.id} disabled, ${reason}`);
      disableAddon(rootDir, culprit.id, reason);
      disabled.push(culprit.id);
    }
  }
}
