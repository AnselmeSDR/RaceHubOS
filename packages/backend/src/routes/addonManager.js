import express from 'express';

/**
 * /api/addon-manager — the Add-ons page's actions. Not under /api/addons: each add-on owns
 * /api/addons/<id>, and an add-on route like POST /update must never meet a core one.
 *
 * An action answers 202 once checked; its steps then go out on `addons:progress`
 * ({ action, addon, step, status, error }) and a success restarts the app (exit 42).
 */

export const PROGRESS_EVENT = 'addons:progress';

const restartApp = () => setTimeout(() => process.exit(42), 2000);

/**
 * @param {{ manager: ReturnType<typeof import('../addons/manager.js').createAddonManager>, io?: object,
 *   restart?: Function, log?: Console }} options
 * @returns {{ router: express.Router, whenIdle: () => Promise<void> }} `whenIdle`: the running action, for tests
 */
export function createAddonManagerRouter({ manager, io, restart = restartApp, log = console }) {
  const router = express.Router();
  let busy = false;
  let running = Promise.resolve();

  const fail = (res, error) => res.status(error.status ?? 500).json({ success: false, error: error.message });

  async function start(res, action, params) {
    if (busy) return res.status(409).json({ success: false, error: 'another add-on action is running' });
    busy = true;
    let prepared;
    try {
      prepared = await manager.prepare(action, params);
    } catch (error) {
      busy = false;
      return fail(res, error);
    }
    res.status(202).json({ success: true, data: { action, addon: prepared.addon } });

    const emit = (step, status = 'running', extra = {}) =>
      io?.emit(PROGRESS_EVENT, { action, addon: prepared.addon, step, status, ...extra });
    // Stays busy after a success: the app restarts, nothing else may start meanwhile
    running = prepared
      .run((step) => emit(step))
      .then(
        () => {
          emit('restart', 'complete');
          restart();
        },
        (error) => {
          log.error(`[addons] ${action} ${prepared.addon ?? ''} failed:`, error);
          emit('error', 'error', { error: error.message });
          busy = false;
        }
      );
  }

  router.get('/', async (req, res) => {
    try {
      res.json({ success: true, data: await manager.list() });
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/install', (req, res) => start(res, 'install', { id: req.body?.id, repo: req.body?.repo }));
  for (const action of ['update', 'enable', 'disable']) {
    router.post(`/:id/${action}`, (req, res) => start(res, action, { id: req.params.id }));
  }
  router.delete('/:id', (req, res) =>
    start(res, 'uninstall', { id: req.params.id, deleteData: req.query.delete_data === '1' })
  );

  return { router, whenIdle: () => running };
}
