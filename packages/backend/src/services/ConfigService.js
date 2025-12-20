import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

export class ConfigService extends EventEmitter {
  constructor(io) {
    super();
    this.prisma = new PrismaClient();
    this.io = io;
  }

  /**
   * Get configuration for a specific controller on a track
   */
  async getConfig(controller, trackId) {
    const config = await this.prisma.controllerConfig.findUnique({
      where: {
        trackId_controller: { trackId, controller: String(controller) }
      },
      include: {
        driver: true,
        car: true
      }
    });

    return config;
  }

  /**
   * Check if a controller is fully configured (has driver AND car)
   */
  async isConfigured(controller, trackId) {
    const config = await this.getConfig(controller, trackId);
    return config?.driverId && config?.carId;
  }

  /**
   * Get all configurations for a track
   */
  async getAllConfigs(trackId) {
    // Get existing configs
    const configs = await this.prisma.controllerConfig.findMany({
      where: { trackId },
      include: {
        driver: true,
        car: true
      },
      orderBy: { controller: 'asc' }
    });

    // Build full list of 6 slots
    const slots = [];
    for (let i = 1; i <= 6; i++) {
      const existing = configs.find(c => c.controller === String(i));
      slots.push({
        controller: String(i),
        driverId: existing?.driverId || null,
        carId: existing?.carId || null,
        driver: existing?.driver || null,
        car: existing?.car || null,
        isActive: true
      });
    }

    return slots;
  }

  /**
   * Update configuration for a controller slot
   */
  async updateConfig(controller, trackId, driverId, carId) {
    const config = await this.prisma.controllerConfig.upsert({
      where: {
        trackId_controller: { trackId, controller: String(controller) }
      },
      create: {
        controller: String(controller),
        trackId,
        driverId: driverId || null,
        carId: carId || null
      },
      update: {
        driverId: driverId || null,
        carId: carId || null
      },
      include: {
        driver: true,
        car: true
      }
    });

    this.emit('config:updated', { controller, config });
    this.io?.emit('config:updated', { controller, config });

    return config;
  }

  /**
   * Update multiple controllers at once
   */
  async updateBulk(trackId, configs) {
    const results = [];

    for (const { controller, driverId, carId } of configs) {
      const config = await this.updateConfig(controller, trackId, driverId, carId);
      results.push(config);
    }

    this.io?.emit('config:bulk-updated', { trackId, configs: results });

    return results;
  }

  /**
   * Clear all configurations for a track
   */
  async clearAll(trackId) {
    await this.prisma.controllerConfig.deleteMany({
      where: { trackId }
    });

    this.io?.emit('config:cleared', { trackId });

    return { success: true };
  }

  /**
   * Get driver/car info for a controller (used by LapRecorder)
   */
  async getDriverCarForController(controller, trackId) {
    const config = await this.getConfig(controller, trackId);

    if (!config?.driverId || !config?.carId) {
      return null;
    }

    return {
      driverId: config.driverId,
      carId: config.carId,
      driver: config.driver,
      car: config.car
    };
  }

  /**
   * Check if all active controllers are configured
   */
  async validateConfiguration(trackId) {
    const configs = await this.getAllConfigs(trackId);
    const unconfigured = configs.filter(c => c.config && !c.isConfigured);

    return {
      valid: unconfigured.length === 0,
      unconfiguredSlots: unconfigured.map(c => c.controller)
    };
  }
}
