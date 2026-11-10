import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  ADDON_ID_PATTERN,
  MANIFEST_FILE,
  addonPaths,
  buildOverrideStacks,
  disableAddon,
  discoverAddons,
  enableAddon,
  findReplacements,
  forgetAddon,
  readState,
  realPosix,
  recordInstall,
  schedulePurge,
  validateManifest,
} from '@racehubos/shared/addons';
import { backupDatabase } from '../lib/backupDatabase.js';
import { isNewerVersion } from '../lib/version.js';
import { buildApp, runNpm } from './build.js';
import { readCatalog } from './catalog.js';
import { EXTRA_TYPES } from './extras.js';
import { latestTag, runGit } from './git.js';

/**
 * Install, update, enable, disable and uninstall add-ons — docs/ADDONS.md § Installing, updating, removing.
 * Each action ends with a build; the route then restarts the app.
 */

export class AddonActionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AddonActionError';
    this.status = status;
  }
}

/** A link a user pasted: anything git accepts, but never an option. */
export function checkRepo(repo) {
  const value = typeof repo === 'string' ? repo.trim() : '';
  if (!value) throw new AddonActionError(400, 'an add-on id or a repository link is required');
  if (value.startsWith('-') || /\s/.test(value)) throw new AddonActionError(400, `"${value}" is not a repository link`);
  return value;
}

function readManifestFrom(dir) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), 'utf-8'));
  } catch (error) {
    throw new AddonActionError(422, `no valid ${MANIFEST_FILE} at the root of the repository (${error.message})`);
  }
  const { manifest, errors } = validateManifest(raw);
  if (!manifest) throw new AddonActionError(422, `invalid add-on: ${errors.join('; ')}`);
  return manifest;
}

function hasDependencies(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    return Object.keys(pkg.dependencies ?? {}).length > 0;
  } catch {
    return false;
  }
}

/** Copies of `addons/.data/` whose database backup was pruned go too. */
export function pruneDataBackups(backupDir) {
  for (const name of fs.readdirSync(backupDir)) {
    if (!name.endsWith('.addons-data')) continue;
    if (fs.existsSync(path.join(backupDir, name.replace(/\.addons-data$/, '.db')))) continue;
    fs.rmSync(path.join(backupDir, name), { recursive: true, force: true });
  }
}

/**
 * @param {object} options
 * @param {string} options.rootDir repository root
 * @param {object} options.prisma core client, to delete an add-on's `*Extra` rows
 * @param {Function} [options.git] runGit, injected by the tests
 * @param {Function} [options.npm] runNpm, injected by the tests
 * @param {Function} [options.backup] backupDatabase
 * @param {Function} [options.catalog] () => readCatalog(rootDir)
 */
export function createAddonManager({
  rootDir,
  prisma,
  git = runGit,
  npm = runNpm,
  backup = backupDatabase,
  catalog = () => readCatalog(rootDir),
  log = console,
}) {
  const build = () => buildApp(rootDir, { npm, log });

  function findAddon(id) {
    if (!ADDON_ID_PATTERN.test(String(id))) throw new AddonActionError(400, `"${id}" is not an add-on id`);
    const addon = discoverAddons(rootDir).find((candidate) => candidate.id === id);
    if (!addon) throw new AddonActionError(404, `add-on "${id}" not found`);
    return addon;
  }

  // A developer's folder is never updated or removed by the app
  function appInstalled(id, verb) {
    const addon = findAddon(id);
    if (!addon.installed) {
      throw new AddonActionError(409, `"${id}" was put in addons/ by hand: the app never ${verb} it`);
    }
    return addon;
  }

  // The database and the add-ons' data, before anything that could damage them
  function backupAll(id) {
    const target = backup({ reason: `addon-${id}` });
    const { dataDir } = addonPaths(rootDir);
    if (!target || !fs.existsSync(dataDir)) return;
    fs.cpSync(dataDir, target.replace(/\.db$/, '.addons-data'), { recursive: true });
    pruneDataBackups(path.dirname(target));
  }

  async function installDependencies(dir, emit) {
    if (!hasDependencies(dir)) return;
    emit('dependencies');
    await npm('npm install --omit=dev --no-audit --no-fund', { cwd: dir });
  }

  // Fails when the add-on itself had to be disabled for the build to pass
  async function buildWith(id) {
    const { disabled } = await build();
    if (disabled.includes(id)) throw new Error(readState(rootDir).disabled[id]?.reason ?? 'build failed');
  }

  async function prepareInstall({ id, repo }) {
    if (id === undefined || id === null) return { addon: null, source: 'link', repo: checkRepo(repo), ref: null };
    const entry = (await catalog()).addons.find((candidate) => candidate.id === id);
    if (!entry) throw new AddonActionError(404, `"${id}" is not in the catalog`);
    if (fs.existsSync(path.join(addonPaths(rootDir).addonsDir, id))) {
      throw new AddonActionError(409, `"${id}" is already installed`);
    }
    return { addon: id, source: 'catalog', repo: entry.repo, ref: entry.ref };
  }

  async function install(job, emit) {
    const { addonsDir } = addonPaths(rootDir);
    fs.mkdirSync(addonsDir, { recursive: true });
    // A dot folder: discovery skips it while it is being filled
    const tmp = path.join(addonsDir, `.install-${randomUUID()}`);
    try {
      emit('download');
      const ref = job.ref ?? (await latestTag(job.repo, git));
      await git(['clone', '--quiet', '--', job.repo, tmp]);
      if (ref) await git(['checkout', '--quiet', '--detach', ref], { cwd: tmp });
      const manifest = readManifestFrom(tmp);
      if (job.addon && manifest.id !== job.addon) {
        throw new AddonActionError(422, `the repository holds "${manifest.id}", not "${job.addon}"`);
      }
      job.addon = manifest.id;
      const dir = path.join(addonsDir, manifest.id);
      if (fs.existsSync(dir)) throw new AddonActionError(409, `"${manifest.id}" is already installed`);

      emit('backup');
      backupAll(manifest.id);
      fs.renameSync(tmp, dir);
      recordInstall(rootDir, manifest.id, { source: job.source, repo: job.repo, ref, version: manifest.version });
      try {
        await installDependencies(dir, emit);
        emit('build');
        await buildWith(manifest.id);
      } catch (error) {
        // A failed install leaves nothing behind
        fs.rmSync(dir, { recursive: true, force: true });
        forgetAddon(rootDir, manifest.id);
        await build().catch(() => {});
        throw error;
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  function prepareUpdate({ id }) {
    const addon = appInstalled(id, 'updates');
    return { addon: id, dir: addon.dir, installed: addon.installed, enabled: addon.enabled };
  }

  async function update(job, emit) {
    const cwd = job.dir;
    emit('download');
    const previous = (await git(['rev-parse', 'HEAD'], { cwd })).stdout.trim();
    await git(['fetch', '--quiet', '--tags', '--force', 'origin'], { cwd });
    const pin = (await catalog()).addons.find((entry) => entry.id === job.addon)?.ref;
    const ref = pin ?? (await latestTag(job.installed.repo, git));

    emit('backup');
    backupAll(job.addon);
    await git(['checkout', '--quiet', '--detach', ref ?? 'origin/HEAD'], { cwd });
    try {
      const manifest = readManifestFrom(cwd);
      if (manifest.id !== job.addon) throw new AddonActionError(422, `the new version is "${manifest.id}"`);
      await installDependencies(cwd, emit);
      emit('build');
      await buildWith(job.addon);
      const { at: _at, ...installed } = job.installed;
      recordInstall(rootDir, job.addon, { ...installed, ref, version: manifest.version });
    } catch (error) {
      // Back to the version that worked
      await git(['checkout', '--quiet', '--detach', previous], { cwd });
      if (job.enabled) enableAddon(rootDir, job.addon);
      await installDependencies(cwd, () => {}).catch(() => {});
      await build().catch(() => {});
      throw error;
    }
  }

  function prepareEnable({ id }) {
    const addon = findAddon(id);
    if (!addon.valid) throw new AddonActionError(422, `invalid add-on: ${addon.errors.join('; ')}`);
    return { addon: id };
  }

  async function enable(job, emit) {
    enableAddon(rootDir, job.addon);
    emit('build');
    await buildWith(job.addon);
  }

  function prepareDisable({ id }) {
    return { addon: findAddon(id).id };
  }

  async function disable(job, emit) {
    disableAddon(rootDir, job.addon, 'disabled by the user');
    emit('build');
    await build();
  }

  function prepareUninstall({ id, deleteData }) {
    const addon = appInstalled(id, 'removes');
    return { addon: id, dir: addon.dir, deleteData: Boolean(deleteData) };
  }

  async function uninstall(job, emit) {
    emit('backup');
    backupAll(job.addon);
    fs.rmSync(job.dir, { recursive: true, force: true });
    forgetAddon(rootDir, job.addon);
    if (job.deleteData) {
      for (const { modelName } of Object.values(EXTRA_TYPES)) {
        await prisma.$executeRawUnsafe(`DELETE FROM "${modelName}" WHERE "addon" = ?`, job.addon);
      }
      // Its database may still be open in this process: the folder goes at the restart
      schedulePurge(rootDir, job.addon);
    }
    emit('build');
    await build();
  }

  const actions = {
    install: [prepareInstall, install],
    update: [prepareUpdate, update],
    enable: [prepareEnable, enable],
    disable: [prepareDisable, disable],
    uninstall: [prepareUninstall, uninstall],
  };

  /**
   * Checks an action, so the route can answer at once, before the slow part.
   *
   * @returns {Promise<{ addon: string|null, run: (emit: (step: string) => void) => Promise<void> }>}
   *   `addon` is known after the clone for an install from a link
   */
  async function prepare(action, params = {}) {
    const entry = actions[action];
    if (!entry) throw new AddonActionError(400, `unknown action "${action}"`);
    const [check, work] = entry;
    const job = await check(params);
    return {
      get addon() {
        return job.addon;
      },
      run: (emit) => work(job, emit),
    };
  }

  async function checkUpdate(addon, catalogAddons) {
    const { installed } = addon;
    if (!installed?.repo) return null;
    const pin = catalogAddons.find((entry) => entry.id === addon.id)?.ref;
    if (pin) return pin === installed.ref ? null : { ref: pin };
    try {
      const tag = await latestTag(installed.repo, git);
      return tag && isNewerVersion(tag, addon.manifest?.version ?? installed.version) ? { ref: tag } : null;
    } catch {
      return null;
    }
  }

  /** Everything the Add-ons page shows. */
  async function list() {
    const { source, addons: catalogAddons } = await catalog();
    const discovered = discoverAddons(rootDir);
    const updates = await Promise.all(discovered.map((addon) => checkUpdate(addon, catalogAddons)));
    const { stacks, orphans } = buildOverrideStacks(
      rootDir,
      discovered.filter((addon) => addon.enabled)
    );
    const root = realPosix(rootDir);
    const relative = (file) => path.posix.relative(root, file);

    return {
      addons: discovered.map((addon, index) => ({
        id: addon.id,
        manifest: addon.manifest,
        valid: addon.valid,
        errors: addon.errors,
        enabled: addon.enabled,
        disabledReason: addon.disabledReason,
        installed: addon.installed,
        update: updates[index],
      })),
      catalog: {
        source,
        addons: catalogAddons.map((entry) => ({
          ...entry,
          installed: discovered.some((addon) => addon.id === entry.id),
        })),
      },
      overrides: {
        stacks: [...stacks].map(([core, layers]) => ({
          file: relative(core),
          layers: layers.map((layer) => layer.id),
        })),
        replacements: findReplacements(stacks).map(({ core, id, hides }) => ({ file: relative(core), id, hides })),
        orphans: orphans.map(({ id, target }) => ({ id, file: target })),
      },
    };
  }

  return { list, prepare };
}
