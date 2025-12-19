import express from 'express';
import { SessionManager } from '../services/SessionManager.js';

const router = express.Router();
let sessionManager;

// Initialiser le SessionManager avec io
export function setSessionManager(manager) {
  sessionManager = manager;
}

/**
 * GET /api/session-control/active
 * Obtenir la session active (DOIT être avant les routes /:id)
 */
router.get('/active', async (req, res) => {
  try {
    const session = await sessionManager.getActiveSession();

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'No active session'
      });
    }

    res.json({
      success: true,
      data: session,
      cuConnected: sessionManager.isCuConnected()
    });
  } catch (error) {
    console.error('Error getting active session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/sync
 * Synchroniser la session avec le CU/Simulateur
 */
router.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const { deviceInfo } = req.body;

    if (!deviceInfo) {
      return res.status(400).json({
        success: false,
        error: 'deviceInfo is required'
      });
    }

    const session = await sessionManager.syncSession(id, deviceInfo);

    res.json({
      success: true,
      data: session,
      message: 'Session synchronisée avec succès'
    });
  } catch (error) {
    console.error('Error syncing session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id/phases/:phase
 * Obtenir l'état d'une phase
 */
router.get('/:id/phases/:phase', async (req, res) => {
  try {
    const { id, phase } = req.params;

    const phaseData = await sessionManager.getPhase(id, phase);

    if (!phaseData) {
      return res.status(404).json({
        success: false,
        error: 'Phase not found'
      });
    }

    res.json({
      success: true,
      data: phaseData
    });
  } catch (error) {
    console.error('Error getting phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/phases/:phase/start
 * Démarrer une phase
 */
router.post('/:id/phases/:phase/start', async (req, res) => {
  try {
    const { id, phase } = req.params;

    const phaseData = await sessionManager.startPhase(id, phase);

    res.json({
      success: true,
      data: phaseData,
      message: `Phase ${phase} démarrée`
    });
  } catch (error) {
    console.error('Error starting phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/phases/:phase/pause
 * Mettre en pause une phase
 */
router.post('/:id/phases/:phase/pause', async (req, res) => {
  try {
    const { id, phase } = req.params;

    const phaseData = await sessionManager.pausePhase(id, phase);

    res.json({
      success: true,
      data: phaseData,
      message: `Phase ${phase} mise en pause`
    });
  } catch (error) {
    console.error('Error pausing phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/phases/:phase/resume
 * Reprendre une phase
 */
router.post('/:id/phases/:phase/resume', async (req, res) => {
  try {
    const { id, phase } = req.params;

    const phaseData = await sessionManager.resumePhase(id, phase);

    res.json({
      success: true,
      data: phaseData,
      message: `Phase ${phase} reprise`
    });
  } catch (error) {
    console.error('Error resuming phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/phases/:phase/finish
 * Terminer une phase
 */
router.post('/:id/phases/:phase/finish', async (req, res) => {
  try {
    const { id, phase } = req.params;

    const phaseData = await sessionManager.finishPhase(id, phase);

    res.json({
      success: true,
      data: phaseData,
      message: `Phase ${phase} terminée`
    });
  } catch (error) {
    console.error('Error finishing phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/finish
 * Terminer toute la session
 */
router.post('/:id/finish', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionManager.finishSession(id);

    res.json({
      success: true,
      data: session,
      message: 'Session terminée'
    });
  } catch (error) {
    console.error('Error finishing session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/phases/:phase/laps
 * Enregistrer un tour
 */
router.post('/:id/phases/:phase/laps', async (req, res) => {
  try {
    const { id, phase } = req.params;
    const { driverId, carId, controller, lapTime, lapNumber, speed } = req.body;

    const lap = await sessionManager.recordLap(id, phase, {
      driverId,
      carId,
      controller,
      lapTime,
      lapNumber,
      speed
    });

    res.json({
      success: true,
      data: lap
    });
  } catch (error) {
    console.error('Error recording lap:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
