import express from 'express';

const router = express.Router();
let trackSyncService = null;

/**
 * Configurer le service TrackSync
 */
export function setTrackSync(service) {
  trackSyncService = service;
}

/**
 * GET /api/bluetooth/status
 * Récupérer l'état de la connexion Bluetooth
 */
router.get('/status', async (req, res) => {
  if (!trackSyncService) {
    return res.json({
      available: false,
      connected: false,
      message: 'Running in simulator mode',
    });
  }

  try {
    const state = trackSyncService.getState();
    res.json({
      available: true,
      connected: state.connected,
      activeSession: state.activeSessionId,
      drivers: state.drivers,
      lastStatus: state.lastStatus,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bluetooth/scan
 * Scanner pour trouver le Control Unit et se connecter automatiquement
 */
router.post('/scan', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    const { timeout = 10000, autoConnect = true } = req.body;
    const address = await trackSyncService.scan(timeout);

    // Auto-connexion après le scan
    if (autoConnect) {
      console.log('🔗 Auto-connecting to Control Unit...');
      await trackSyncService.connect(); // Sans adresse, utilise le peripheral trouvé
      // Démarrer le polling automatiquement
      trackSyncService.startPolling(100);
    }

    res.json({
      success: true,
      address,
      connected: autoConnect,
      message: autoConnect ? 'Control Unit found and connected' : 'Control Unit found',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/connect
 * Se connecter au Control Unit
 */
router.post('/connect', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    const { address } = req.body;
    await trackSyncService.connect(address);

    res.json({
      success: true,
      message: 'Connected to Control Unit',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/disconnect
 * Se déconnecter du Control Unit
 */
router.post('/disconnect', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    await trackSyncService.disconnect();

    res.json({
      success: true,
      message: 'Disconnected from Control Unit',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/bluetooth/version
 * Récupérer la version du Control Unit
 */
router.get('/version', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    const version = await trackSyncService.getVersion();

    res.json({
      success: true,
      version,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/start-polling
 * Démarrer le polling du Control Unit
 */
router.post('/start-polling', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    const { interval = 100 } = req.body;
    trackSyncService.startPolling(interval);

    res.json({
      success: true,
      message: 'Polling started',
      interval,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/stop-polling
 * Arrêter le polling du Control Unit
 */
router.post('/stop-polling', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    trackSyncService.stopPolling();

    res.json({
      success: true,
      message: 'Polling stopped',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/load-session
 * Charger la session active
 */
router.post('/load-session', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    const session = await trackSyncService.loadActiveSession();

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/start-session
 * Démarrer une session
 */
router.post('/start-session', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required',
      });
    }

    await trackSyncService.startSession(sessionId);

    res.json({
      success: true,
      message: 'Session started',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/stop-session
 * Arrêter la session active
 */
router.post('/stop-session', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    await trackSyncService.stopSession();

    res.json({
      success: true,
      message: 'Session stopped',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/start-race
 * Démarrer la course sur le Control Unit (bouton START)
 */
router.post('/start-race', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    await trackSyncService.startRace();
    res.json({
      success: true,
      message: 'Race started on Control Unit',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/reset-timer
 * Réinitialiser le timer du Control Unit
 */
router.post('/reset-timer', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({
      error: 'Not available in simulator mode',
    });
  }

  try {
    await trackSyncService.resetTimer();
    res.json({
      success: true,
      message: 'Timer reset',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/bluetooth/esc
 * Appuyer sur ESC/Pace Car (arrêter la course)
 */
router.post('/esc', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    await trackSyncService.pressEsc();
    res.json({ success: true, message: 'ESC pressed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/button/:id
 * Appuyer sur un bouton du CU (1=ESC, 2=START, 5=SPEED, 6=BRAKE, 7=FUEL, 8=CODE)
 */
router.post('/button/:id', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const buttonId = parseInt(req.params.id);
    if (isNaN(buttonId) || buttonId < 1 || buttonId > 8) {
      return res.status(400).json({ error: 'Invalid button ID (1-8)' });
    }
    await trackSyncService.pressButton(buttonId);
    res.json({ success: true, message: `Button ${buttonId} pressed` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/clear-position
 * Effacer l'affichage de la Position Tower
 */
router.post('/clear-position', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    await trackSyncService.clearPosition();
    res.json({ success: true, message: 'Position tower cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-speed
 * Définir la vitesse d'un controller
 */
router.post('/set-speed', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address, value } = req.body;
    await trackSyncService.setSpeed(address, value);
    res.json({ success: true, message: `Speed set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-brake
 * Définir le frein d'un controller
 */
router.post('/set-brake', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address, value } = req.body;
    await trackSyncService.setBrake(address, value);
    res.json({ success: true, message: `Brake set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-fuel
 * Définir le fuel d'un controller
 */
router.post('/set-fuel', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address, value } = req.body;
    await trackSyncService.setFuel(address, value);
    res.json({ success: true, message: `Fuel set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/power-off
 * Arrêter toutes les voitures (ESC + ignore + brake)
 */
router.post('/power-off', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    await trackSyncService.powerOff();
    res.json({ success: true, message: 'All cars stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/power-on
 * Réactiver toutes les voitures
 */
router.post('/power-on', async (req, res) => {
  if (!trackSyncService) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    await trackSyncService.powerOn();
    res.json({ success: true, message: 'All cars enabled' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
