import express from 'express';

const router = express.Router();
let configService;

export function setConfigService(service) {
  configService = service;
}

/**
 * GET /api/config
 * Get all controller configurations for a track
 */
router.get('/', async (req, res) => {
  try {
    const { trackId } = req.query;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'trackId is required'
      });
    }

    const configs = await configService.getAllConfigs(trackId);

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error fetching configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/config/bulk
 * Update multiple controller configurations at once
 * Note: Must be defined BEFORE /:controller to avoid route collision
 */
router.put('/bulk', async (req, res) => {
  try {
    const { trackId, controllers } = req.body;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'trackId is required'
      });
    }

    if (!controllers || !Array.isArray(controllers)) {
      return res.status(400).json({
        success: false,
        error: 'controllers array is required'
      });
    }

    const configs = await configService.updateBulk(trackId, controllers);

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error bulk updating configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/config/validate
 * Validate that all controllers are properly configured
 * Note: Must be defined BEFORE /:controller to avoid route collision
 */
router.get('/validate', async (req, res) => {
  try {
    const { trackId } = req.query;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'trackId is required'
      });
    }

    const result = await configService.validateConfiguration(trackId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error validating configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/config/:controller
 * Get configuration for a specific controller
 */
router.get('/:controller', async (req, res) => {
  try {
    const { controller } = req.params;
    const { trackId } = req.query;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'trackId is required'
      });
    }

    const config = await configService.getConfig(controller, trackId);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/config/:controller
 * Update configuration for a specific controller
 */
router.put('/:controller', async (req, res) => {
  try {
    const { controller } = req.params;
    const { trackId, driverId, carId } = req.body;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'trackId is required'
      });
    }

    const config = await configService.updateConfig(controller, trackId, driverId, carId);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/config
 * Clear all configurations for a track
 */
router.delete('/', async (req, res) => {
  try {
    const { trackId } = req.query;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        error: 'trackId is required'
      });
    }

    await configService.clearAll(trackId);

    res.json({
      success: true,
      message: 'All configurations cleared'
    });
  } catch (error) {
    console.error('Error clearing configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
