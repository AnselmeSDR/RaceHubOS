import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

let championshipService;

export function setChampionshipService(service) {
  championshipService = service;
}

// GET /api/championships - Liste tous les championnats
router.get('/', async (req, res) => {
  try {
    const championships = await prisma.championship.findMany({
      include: {
        track: true,
        sessions: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: championships,
      count: championships.length,
    });
  } catch (error) {
    console.error('Error fetching championships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch championships',
    });
  }
});

// GET /api/championships/:id - Récupère un championnat par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const championship = await prisma.championship.findUnique({
      where: { id },
      include: {
        track: true,
        sessions: {
          include: {
            track: true,
            drivers: {
              include: {
                driver: true,
                car: true,
              },
            },
            laps: {
              orderBy: {
                timestamp: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!championship) {
      return res.status(404).json({
        success: false,
        error: 'Championship not found',
      });
    }

    res.json({
      success: true,
      data: championship,
    });
  } catch (error) {
    console.error('Error fetching championship:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch championship',
    });
  }
});

// POST /api/championships - Crée un nouveau championnat
router.post('/', async (req, res) => {
  try {
    const { name, season, pointsSystem, status, trackId } = req.body;

    // Validation
    if (!name || !season) {
      return res.status(400).json({
        success: false,
        error: 'Name and season are required',
      });
    }

    // Validate trackId if provided
    if (trackId) {
      const track = await prisma.track.findUnique({ where: { id: trackId } });
      if (!track) {
        return res.status(400).json({
          success: false,
          error: 'Track not found',
        });
      }
    }

    const championship = await prisma.championship.create({
      data: {
        name: name.trim(),
        season: season.trim(),
        status: status || 'planned',
        trackId: trackId || null,
      },
      include: {
        track: true,
        sessions: true,
      },
    });

    // Create permanent free practice session for this championship
    await prisma.session.create({
      data: {
        name: 'Essais Libres',
        type: 'practice',
        status: 'draft',
        championshipId: championship.id,
        trackId: trackId || null,
      },
    });

    // Refetch with the new session
    const result = await prisma.championship.findUnique({
      where: { id: championship.id },
      include: {
        track: true,
        sessions: true,
      },
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error creating championship:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create championship',
    });
  }
});

// PUT /api/championships/:id - Modifie un championnat
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, season, pointsSystem, status } = req.body;

    const exists = await prisma.championship.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Championship not found',
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (season !== undefined) updateData.season = season.trim();
    if (status !== undefined) updateData.status = status;

    if (pointsSystem !== undefined) {
      try {
        if (typeof pointsSystem === 'string') {
          JSON.parse(pointsSystem);
          updateData.pointsSystem = pointsSystem;
        } else {
          updateData.pointsSystem = JSON.stringify(pointsSystem);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid points system format',
        });
      }
    }

    const championship = await prisma.championship.update({
      where: { id },
      data: updateData,
      include: {
        sessions: true,
      },
    });

    res.json({
      success: true,
      data: championship,
    });
  } catch (error) {
    console.error('Error updating championship:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update championship',
    });
  }
});

// DELETE /api/championships/:id - Supprime un championnat
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await prisma.championship.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Championship not found',
      });
    }

    // Delete related data in order (respecting foreign keys)
    // 1. Delete laps for all sessions
    await prisma.lap.deleteMany({
      where: { session: { championshipId: id } },
    });

    // 2. Delete race events for all sessions
    await prisma.raceEvent.deleteMany({
      where: { session: { championshipId: id } },
    });

    // 3. Delete session drivers for all sessions
    await prisma.sessionDriver.deleteMany({
      where: { session: { championshipId: id } },
    });

    // 4. Delete session phases for all sessions
    await prisma.sessionPhase.deleteMany({
      where: { session: { championshipId: id } },
    });

    // 5. Delete all sessions
    await prisma.session.deleteMany({
      where: { championshipId: id },
    });

    // 6. Delete championship
    await prisma.championship.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Championship deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting championship:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete championship',
    });
  }
});

/**
 * POST /api/championships/:id/sessions
 * Create a new session in this championship
 * Body: { type, name, duration, maxLaps, order, gridFromQualifying }
 */
router.post('/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify championship exists
    const championship = await prisma.championship.findUnique({ where: { id } });
    if (!championship) {
      return res.status(404).json({ success: false, error: 'Championship not found' });
    }

    const session = await championshipService.createSession(id, req.body);

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/championships/:id/standings - Récupère le classement d'un championnat
// Query param: ?type=qualif|race|practice (required)
router.get('/:id/standings', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type parameter is required. Must be one of: qualif, race, practice',
      });
    }

    // Runtime calculation based on type
    const championship = await prisma.championship.findUnique({
      where: { id },
      include: {
        sessions: {
          where: type === 'practice' ? { type: 'practice' } : {
            type: type === 'qualif' ? 'qualif' : 'race',
            status: 'finished'
          },
          include: {
            drivers: {
              include: { driver: true }
            },
            laps: type !== 'race' ? {
              // For practice: include ALL laps (no softDeletedAt filter)
              // For qualif: only active laps
              where: type === 'qualif' ? { softDeletedAt: null } : undefined
            } : undefined
          }
        }
      }
    });

    if (!championship) {
      return res.status(404).json({
        success: false,
        error: 'Championship not found',
      });
    }

    let standings = [];

    if (type === 'qualif') {
      // Qualifying standings: MIN(lapTime) grouped by driverId
      const driverBestTimes = {};

      championship.sessions.forEach(session => {
        session.laps.forEach(lap => {
          const lapTimeMs = Math.round(lap.lapTime);
          if (!driverBestTimes[lap.driverId] || lapTimeMs < driverBestTimes[lap.driverId].bestTime) {
            driverBestTimes[lap.driverId] = {
              driverId: lap.driverId,
              bestTime: lapTimeMs
            };
          }
        });
      });

      // Get driver details
      const driverIds = Object.keys(driverBestTimes);
      const drivers = await prisma.driver.findMany({
        where: { id: { in: driverIds } }
      });
      const driverMap = Object.fromEntries(drivers.map(d => [d.id, d]));

      standings = Object.values(driverBestTimes)
        .sort((a, b) => a.bestTime - b.bestTime)
        .map((entry, index) => ({
          position: index + 1,
          driverId: entry.driverId,
          driver: driverMap[entry.driverId],
          bestTime: entry.bestTime
        }));

    } else if (type === 'race') {
      // Race standings: SUM(totalLaps), SUM(totalTime) grouped by driverId
      const driverStats = {};

      championship.sessions.forEach(session => {
        session.drivers.forEach(sd => {
          if (!driverStats[sd.driverId]) {
            driverStats[sd.driverId] = {
              driverId: sd.driverId,
              driver: sd.driver,
              totalLaps: 0,
              totalTime: 0,
              finishedRaces: 0
            };
          }
          driverStats[sd.driverId].totalLaps += sd.totalLaps || 0;
          driverStats[sd.driverId].totalTime += sd.totalTime || 0;
          if (!sd.isDNF && sd.totalLaps > 0) {
            driverStats[sd.driverId].finishedRaces++;
          }
        });
      });

      standings = Object.values(driverStats)
        .sort((a, b) => {
          // More laps = better
          if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps;
          // Same laps: less time = better
          return a.totalTime - b.totalTime;
        })
        .map((entry, index) => ({
          position: index + 1,
          driverId: entry.driverId,
          driver: entry.driver,
          totalLaps: entry.totalLaps,
          totalTime: entry.totalTime,
          finishedRaces: entry.finishedRaces
        }));

    } else if (type === 'practice') {
      // Practice standings: MIN(lapTime) grouped by driverId (includes soft-deleted laps)
      const practiceSession = championship.sessions[0]; // There's only one practice session per championship

      if (!practiceSession) {
        return res.json({
          success: true,
          type: 'practice',
          standings: [],
          count: 0
        });
      }

      const driverBestTimes = {};

      practiceSession.laps.forEach(lap => {
        const lapTimeMs = Math.round(lap.lapTime);
        if (!driverBestTimes[lap.driverId] || lapTimeMs < driverBestTimes[lap.driverId].bestTime) {
          driverBestTimes[lap.driverId] = {
            driverId: lap.driverId,
            bestTime: lapTimeMs
          };
        }
      });

      // Get driver details
      const driverIds = Object.keys(driverBestTimes);
      const drivers = await prisma.driver.findMany({
        where: { id: { in: driverIds } }
      });
      const driverMap = Object.fromEntries(drivers.map(d => [d.id, d]));

      standings = Object.values(driverBestTimes)
        .sort((a, b) => a.bestTime - b.bestTime)
        .map((entry, index) => ({
          position: index + 1,
          driverId: entry.driverId,
          driver: driverMap[entry.driverId],
          bestTime: entry.bestTime
        }));

    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be one of: qualif, race, practice'
      });
    }

    res.json({
      success: true,
      type,
      standings,
      count: standings.length,
    });
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standings',
    });
  }
});

export default router;
