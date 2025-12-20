import express from 'express';

const router = express.Router();
let raceController = null;

export function setRaceController(controller) {
  raceController = controller;
}

function ensureController(req, res, next) {
  if (!raceController) {
    return res.status(503).json({ success: false, error: 'Race controller not initialized' });
  }
  next();
}

router.use(ensureController);

// GET /status - Get current race state and leaderboard
router.get('/status', async (req, res) => {
  try {
    const state = await raceController.getState();
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /qualifying - Start a qualifying session
router.post('/qualifying', async (req, res) => {
  try {
    const { name, trackId, duration, maxLaps, championshipId } = req.body;
    const result = await raceController.startQualifying({ name, trackId, duration, maxLaps, championshipId });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /race - Start a race session
router.post('/race', async (req, res) => {
  try {
    const { name, trackId, duration, maxLaps, championshipId, gridFromQualifying } = req.body;
    const result = await raceController.startRace({ name, trackId, duration, maxLaps, championshipId, gridFromQualifying });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /start - Begin countdown/race
router.post('/start', async (req, res) => {
  try {
    const result = await raceController.start();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /pause - Pause the race
router.post('/pause', async (req, res) => {
  try {
    const result = await raceController.pause();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /resume - Resume the race
router.post('/resume', async (req, res) => {
  try {
    const result = await raceController.resume();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /finish - End the race
router.post('/finish', async (req, res) => {
  try {
    const result = await raceController.finish();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /stop - Cancel/stop the race
router.post('/stop', async (req, res) => {
  try {
    const result = await raceController.stop();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /dismiss - Dismiss results and return to idle
router.post('/dismiss', async (req, res) => {
  try {
    const result = await raceController.dismiss();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
