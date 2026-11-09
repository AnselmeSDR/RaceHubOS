import { execFileSync } from 'child_process';
import path from 'path';
import { writeFile } from './addonFixtures.js';

// No global config, hooks or signing from the machine running the tests
const IDENTITY = [
  '-c',
  'user.name=RaceHubOS tests',
  '-c',
  'user.email=tests@racehubos.invalid',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'tag.gpgsign=false',
  '-c',
  'core.hooksPath=/dev/null',
];

export function git(cwd, ...args) {
  return execFileSync('git', [...IDENTITY, ...args], { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
}

/**
 * An add-on repository with one tagged commit per version.
 *
 * @param {string} base folder holding the repository
 * @param {string} id add-on id
 * @param {string[]} versions tagged `v<version>`, in this order
 * @param {{ files?: Record<string, string|object|((version: string) => string)>, manifest?: object,
 *   untagged?: string }} [options] `untagged`: a last commit with this version and no tag
 * @returns {string} the repository path, usable as a link
 */
export function makeRepo(base, id, versions, { files = {}, manifest = {}, untagged = null } = {}) {
  const dir = path.join(base, 'repos', `racehubos-${id}`);
  writeFile(dir, '.keep');
  git(dir, 'init', '--quiet', '--initial-branch=main');
  const commit = (version, tag) => {
    writeFile(dir, 'racehubos-addon.json', { id, name: id, version, ...manifest });
    for (const [relative, content] of Object.entries(files)) {
      writeFile(dir, relative, typeof content === 'function' ? content(version) : content);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '--quiet', '-m', `version ${version}`);
    if (tag) git(dir, 'tag', `v${version}`);
  };
  versions.forEach((version) => commit(version, true));
  if (untagged) commit(untagged, false);
  return dir;
}

/** A new tagged version on an existing repository. */
export function release(dir, id, version, { manifest = {} } = {}) {
  writeFile(dir, 'racehubos-addon.json', { id, name: id, version, ...manifest });
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', `version ${version}`);
  git(dir, 'tag', `v${version}`);
}
