import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

export class LapRecorderService extends EventEmitter {
  constructor(io, configService) {
    super();
    this.prisma = new PrismaClient();
    this.io = io;
    this.configService = configService;

    // Track last timestamp per controller for lap time calculation
    this.lastTimestamps = new Map();

    // Track lap counts per controller/session
    this.lapCounts = new Map();
  }

  /**
   * Record a lap from the Control Unit
   * @param {string} controller - Controller number (1-6)
   * @param {number} timestamp - CU timestamp in milliseconds
   * @param {string} trackId - Track ID
   * @param {string|null} sessionId - Session ID (null for free practice)
   * @param {string} phase - Phase name (for sessions) or 'practice' for free practice
   */
  async recordLap(controller, timestamp, trackId, sessionId = null, phase = 'practice') {
    const controllerKey = `${trackId}-${controller}`;

    // Calculate lap time from last timestamp
    const lastTs = this.lastTimestamps.get(controllerKey);
    this.lastTimestamps.set(controllerKey, timestamp);

    if (!lastTs) {
      // First crossing - no lap time yet
      console.log(`🏎️ Controller ${controller}: First crossing, waiting for lap`);
      return null;
    }

    const lapTime = timestamp - lastTs;

    // Validate lap time (minimum 2 seconds, maximum 5 minutes)
    if (lapTime < 2000 || lapTime > 300000) {
      console.log(`⚠️ Controller ${controller}: Invalid lap time ${lapTime}ms, ignoring`);
      return null;
    }

    // Get controller configuration
    const config = await this.configService.getDriverCarForController(controller, trackId);

    if (!config) {
      // Controller not configured - emit warning but don't save
      console.log(`⚠️ Controller ${controller}: Not configured, lap not saved`);

      this.emit('lap:unconfigured', {
        controller,
        lapTime,
        trackId,
        sessionId
      });

      this.io?.emit('lap:unconfigured', {
        controller,
        lapTime,
        message: `Controller ${controller} non configuré - tour non enregistré`
      });

      return null;
    }

    // Get lap number
    const lapCountKey = sessionId ? `${sessionId}-${config.driverId}` : `${trackId}-${config.driverId}`;
    const currentLapCount = this.lapCounts.get(lapCountKey) || 0;
    const lapNumber = currentLapCount + 1;
    this.lapCounts.set(lapCountKey, lapNumber);

    // Record the lap
    const lap = await this.prisma.lap.create({
      data: {
        trackId,
        sessionId,
        driverId: config.driverId,
        carId: config.carId,
        controller: String(controller),
        phase,
        lapNumber,
        lapTime
      },
      include: {
        driver: true,
        car: true
      }
    });

    console.log(`🏁 Lap recorded: ${config.driver.name} - ${this.formatLapTime(lapTime)} (Lap ${lapNumber})`);

    // Check and update track record
    const isNewRecord = await this.checkTrackRecord(lap);

    // Emit events
    this.emit('lap:recorded', {
      ...lap,
      isNewRecord
    });

    this.io?.emit('lap:completed', {
      ...lap,
      isNewRecord,
      formattedTime: this.formatLapTime(lapTime)
    });

    return lap;
  }

  /**
   * Check if this lap is a new track record and update if so
   */
  async checkTrackRecord(lap) {
    const existing = await this.prisma.trackRecord.findUnique({
      where: {
        trackId_driverId_carId: {
          trackId: lap.trackId,
          driverId: lap.driverId,
          carId: lap.carId
        }
      }
    });

    if (!existing || lap.lapTime < existing.lapTime) {
      await this.prisma.trackRecord.upsert({
        where: {
          trackId_driverId_carId: {
            trackId: lap.trackId,
            driverId: lap.driverId,
            carId: lap.carId
          }
        },
        create: {
          trackId: lap.trackId,
          driverId: lap.driverId,
          carId: lap.carId,
          lapTime: lap.lapTime,
          sessionId: lap.sessionId
        },
        update: {
          lapTime: lap.lapTime,
          sessionId: lap.sessionId,
          setAt: new Date()
        }
      });

      console.log(`🏆 New track record: ${this.formatLapTime(lap.lapTime)}`);

      this.io?.emit('record:new', {
        trackId: lap.trackId,
        driverId: lap.driverId,
        carId: lap.carId,
        lapTime: lap.lapTime,
        formattedTime: this.formatLapTime(lap.lapTime)
      });

      return true;
    }

    return false;
  }

  /**
   * Reset timestamps and lap counts (called when starting a new session)
   */
  reset() {
    this.lastTimestamps.clear();
    this.lapCounts.clear();
    console.log('🔄 LapRecorder reset');
  }

  /**
   * Reset for a specific session (called when finishing a session)
   */
  resetSession(sessionId) {
    // Clear lap counts for this session
    for (const [key] of this.lapCounts) {
      if (key.startsWith(sessionId)) {
        this.lapCounts.delete(key);
      }
    }
  }

  /**
   * Get current lap count for a driver in a session
   */
  getLapCount(sessionId, driverId) {
    const key = `${sessionId}-${driverId}`;
    return this.lapCounts.get(key) || 0;
  }

  /**
   * Format lap time for display
   */
  formatLapTime(ms) {
    if (!ms) return '-';

    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(3);

    if (mins > 0) {
      return `${mins}:${secs.padStart(6, '0')}`;
    }
    return `${secs}s`;
  }

  /**
   * Initialize lap counts from database for a session
   */
  async initializeFromSession(sessionId) {
    const laps = await this.prisma.lap.groupBy({
      by: ['driverId'],
      where: { sessionId },
      _count: { id: true }
    });

    for (const entry of laps) {
      const key = `${sessionId}-${entry.driverId}`;
      this.lapCounts.set(key, entry._count.id);
    }
  }

  /**
   * Set the current track for free practice
   */
  setActiveTrack(trackId) {
    this.activeTrackId = trackId;
  }

  /**
   * Get the active track ID
   */
  getActiveTrack() {
    return this.activeTrackId;
  }
}
