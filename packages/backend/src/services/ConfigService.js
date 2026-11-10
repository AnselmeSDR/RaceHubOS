import { createPrismaClient } from '../lib/prisma.js';
import { EventEmitter } from 'events';

const SLOTS = 6;
const withPeople = { driver: true, car: true };

/** Driver and car of each controller slot (0-5), by track. */
export class ConfigService extends EventEmitter {
  constructor(io) {
    super();
    this.prisma = createPrismaClient();
    this.io = io;
  }

  async getConfig(controller, trackId) {
    return this.prisma.controllerConfig.findUnique({
      where: { trackId_controller: { trackId, controller: Number(controller) } },
      include: withPeople,
    });
  }

  /** The six slots of a track, empty ones included. */
  async getAllConfigs(trackId) {
    const configs = await this.prisma.controllerConfig.findMany({ where: { trackId }, include: withPeople });
    return Array.from({ length: SLOTS }, (_, controller) => {
      const config = configs.find((c) => c.controller === controller);
      return {
        controller,
        driverId: config?.driverId || null,
        carId: config?.carId || null,
        driver: config?.driver || null,
        car: config?.car || null,
        isActive: true,
      };
    });
  }

  async updateConfig(controller, trackId, driverId, carId) {
    const slot = { driverId: driverId || null, carId: carId || null };
    controller = Number(controller);
    const config = await this.prisma.controllerConfig.upsert({
      where: { trackId_controller: { trackId, controller } },
      create: { controller, trackId, ...slot },
      update: slot,
      include: withPeople,
    });
    this.emit('config:updated', { controller, config });
    this.io?.emit('config:updated', { controller, config });
    return config;
  }

  async updateBulk(trackId, configs) {
    const results = [];
    for (const { controller, driverId, carId } of configs) {
      results.push(await this.updateConfig(controller, trackId, driverId, carId));
    }
    this.io?.emit('config:bulk-updated', { trackId, configs: results });
    return results;
  }

  async clearAll(trackId) {
    await this.prisma.controllerConfig.deleteMany({ where: { trackId } });
    this.io?.emit('config:cleared', { trackId });
    return { success: true };
  }

  /** Slots given a driver without a car, or the reverse. */
  async validateConfiguration(trackId) {
    const halfSet = (await this.getAllConfigs(trackId)).filter((slot) => !slot.driverId !== !slot.carId);
    return { valid: halfSet.length === 0, unconfiguredSlots: halfSet.map((slot) => slot.controller) };
  }
}
