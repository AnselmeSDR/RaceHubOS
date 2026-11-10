import { execFile } from 'child_process';
import { promisify } from 'util';
import { compareVersions } from '../lib/version.js';

const execFileAsync = promisify(execFile);

/**
 * git without a shell: repository links come from users. GIT_TERMINAL_PROMPT=0 makes a
 * private repository fail at once instead of waiting for a password nobody will type.
 */
export function runGit(args, { cwd, timeout = 120000 } = {}) {
  return execFileAsync('git', args, {
    cwd,
    timeout,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

const VERSION_TAG = /\trefs\/tags\/(v\d+\.\d+\.\d+)$/;

/** Highest `vX.Y.Z` tag in `git ls-remote --tags` output, or null. Pre-releases are left out. */
export function highestVersionTag(lsRemoteOutput) {
  const tags = lsRemoteOutput
    .split('\n')
    .map((line) => line.trim().match(VERSION_TAG)?.[1])
    .filter(Boolean);
  return tags.sort(compareVersions).at(-1) ?? null;
}

/** The release the app installs from `repo` — docs/ADDONS.md § Versions. */
export async function latestTag(repo, git = runGit) {
  const { stdout } = await git(['ls-remote', '--tags', '--refs', repo], { timeout: 30000 });
  return highestVersionTag(stdout);
}
