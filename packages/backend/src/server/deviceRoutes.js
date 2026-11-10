import express from 'express';

/** /api/sync: the hardware sync state, the live leaderboard and race control, whatever the device. */
export function createSyncRouter({ syncService, sessionService }) {
  const router = express.Router();

  router.get('/state', (req, res) => {
    res.json({ ...syncService.getState(), session: sessionService.getState() });
  });

  router.get('/leaderboard', (req, res) => {
    res.json(sessionService.getLeaderboard());
  });

  router.post('/load-session/:sessionId', async (req, res) => {
    try {
      const session = await sessionService.loadSession(req.params.sessionId);
      res.json({ success: true, session: { id: session.id, type: session.type } });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/reset', async (req, res) => {
    await sessionService.resetForNewSession();
    res.json({ success: true });
  });

  router.post('/start', async (req, res) => {
    await syncService.startRace();
    res.json({ success: true });
  });

  router.post('/stop', async (req, res) => {
    await syncService.stopRace();
    res.json({ success: true });
  });

  router.post('/button/:button', async (req, res) => {
    const button = parseInt(req.params.button, 10);
    await syncService.pressButton(button);
    res.json({ success: true, button });
  });

  router.get('/cu-status', (req, res) => {
    res.json(syncService.getCuStatus() || { error: 'No status yet' });
  });

  return router;
}

/** /api/simulator: the simulator's state, and direct start, stop and pause once it is connected. */
export function createSimulatorRouter({ simulator, syncService }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({ ...simulator.getState(), isConnected: syncService.getDevice() === simulator });
  });

  for (const [action, command, status] of [
    ['start', 'start', 'started'],
    ['stop', 'stop', 'stopped'],
    ['pause', 'togglePause', 'toggled'],
  ]) {
    router.post(`/${action}`, (req, res) => {
      if (!simulator.isConnected()) return res.status(400).json({ error: 'Simulator not connected' });
      simulator[command]();
      res.json({ status });
    });
  }

  return router;
}
