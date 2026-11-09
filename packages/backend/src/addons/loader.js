import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import express from 'express';
import { ADDON_ID_PATTERN, addonPaths, disableAddon, discoverAddons, takePurges } from '@racehubos/shared/addons';
import { createAddonDatabase } from './database.js';
import { createAddonEvents } from './events.js';
import { createExtras, createExtrasRouter, scopePrisma } from './extras.js';

/** `ctx.log`: the console, prefixed with the add-on. */
export function createAddonLog(id, logger = console) {
  const prefix = `[addon:${id}]`;
  return {
    info: (...args) => logger.log(prefix, ...args),
    warn: (...args) => logger.warn(prefix, ...args),
    error: (...args) => logger.error(prefix, ...args),
  };
}

/** The first line of an error, kept as the reason an add-on was disabled. */
function reasonOf(error) {
  return String(error?.message ?? error).split('\n')[0];
}

/**
 * Builds `ctx` for one add-on — docs/ADDONS.md § Server side.
 *
 * @returns {{ ctx: object, dispose: Function }} `dispose` releases what the core created for it
 */
export function createAddonContext({
  addon,
  rootDir,
  app,
  io,
  events,
  prisma,
  services,
  version,
  coreDatabasePath,
  logger,
}) {
  const { id, manifest } = addon;
  const dataDir = path.join(addonPaths(rootDir).dataDir, id);
  fs.mkdirSync(dataDir, { recursive: true });

  const log = createAddonLog(id, logger);
  const addonEvents = createAddonEvents(events, log);
  const database = createAddonDatabase({ dataDir, id, coreDatabasePath });
  const extra = createExtras(prisma, id);
  const router = express.Router();
  router.use(createExtrasRouter(extra));

  const ctx = {
    id,
    manifest,
    version,
    router,
    app,
    io,
    events: addonEvents,
    prisma: scopePrisma(prisma, id),
    extra,
    services,
    dataDir,
    openDatabase: database.open,
    migrate: database.migrate,
    log,
  };

  const dispose = () => {
    addonEvents.removeAll();
    database.close();
  };

  return { ctx, dispose };
}

/**
 * Loads every enabled add-on with server code and mounts its router at /api/addons/<id>.
 * An add-on that fails to load never stops the app: it is disabled (an installed add-on,
 * until the user enables it again) or skipped for this run (a developer's folder).
 *
 * @param {object} options
 * @param {string} options.rootDir repository root
 * @param {import('express').Express} options.app
 * @param {object} options.io socket.io server
 * @param {import('events').EventEmitter} options.events mirror of io.emit (mirrorEmits)
 * @param {import('@prisma/client').PrismaClient} options.prisma core client
 * @param {object} options.services running core services
 * @param {string} options.version RaceHubOS version
 * @param {string|null} [options.coreDatabasePath] attached as `core` in add-on databases
 * @param {Console} [options.logger]
 * @param {(url: string) => Promise<object>} [options.importModule] for tests
 */
/**
 * Deletes the data of add-ons uninstalled with their data, before anything opens it.
 * Done at the start: the previous run may have held their database open (Windows).
 */
export function purgeAddonData(rootDir, logger = console) {
  const { dataDir } = addonPaths(rootDir);
  for (const id of takePurges(rootDir)) {
    // state.json can be edited by hand: never a path outside .data/
    if (!ADDON_ID_PATTERN.test(id)) continue;
    fs.rmSync(path.join(dataDir, id), { recursive: true, force: true });
    logger.log(`[addon:${id}] data deleted`);
  }
}

export async function loadAddons({
  rootDir,
  app,
  io,
  events,
  prisma,
  services,
  version,
  coreDatabasePath = null,
  logger = console,
  importModule = (url) => import(url),
}) {
  const loaded = [];
  const failed = [];
  purgeAddonData(rootDir, logger);

  for (const addon of discoverAddons(rootDir)) {
    if (!addon.enabled) continue;

    const { ctx, dispose } = createAddonContext({
      addon,
      rootDir,
      app,
      io,
      events,
      prisma,
      services,
      version,
      coreDatabasePath,
      logger,
    });

    try {
      let cleanup = null;
      if (addon.serverEntry) {
        const module = await importModule(pathToFileURL(addon.serverEntry).href);
        const register = module.default ?? module.register;
        if (typeof register !== 'function') {
          throw new Error('server/index.js must export a register(ctx) function, as its default export');
        }
        cleanup = await register(ctx);
      }
      app.use(`/api/addons/${addon.id}`, ctx.router);
      loaded.push({ id: addon.id, ctx, dispose, cleanup: typeof cleanup === 'function' ? cleanup : null });
      ctx.log.info('loaded');
    } catch (error) {
      dispose();
      const reason = reasonOf(error);
      ctx.log.error('failed to load, disabled:', error);
      if (addon.installed) disableAddon(rootDir, addon.id, reason);
      failed.push({ id: addon.id, reason });
    }
  }

  /** Calls every add-on's cleanup, then releases its listeners and database. */
  const unload = async () => {
    for (const { ctx, dispose, cleanup } of loaded) {
      try {
        await cleanup?.();
      } catch (error) {
        ctx.log.error('cleanup failed:', error);
      }
      dispose();
    }
  };

  return { loaded: loaded.map(({ id }) => id), failed, unload };
}
