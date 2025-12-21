import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/championships - Liste tous les championnats
router.get('/', async (req, res) => {
  try {
    const championships = await prisma.championship.findMany({
      include: {
        track: true,
        standings: {
          orderBy: {
            position: 'asc',
          },
        },
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
        standings: {
          orderBy: {
            position: 'asc',
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

    // Valider le système de points (doit être un objet JSON valide)
    let validatedPointsSystem = pointsSystem;
    if (pointsSystem) {
      try {
        if (typeof pointsSystem === 'string') {
          JSON.parse(pointsSystem); // Vérifie que c'est du JSON valide
        } else {
          validatedPointsSystem = JSON.stringify(pointsSystem);
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid points system format',
        });
      }
    }

    const championship = await prisma.championship.create({
      data: {
        name: name.trim(),
        season: season.trim(),
        pointsSystem: validatedPointsSystem || JSON.stringify({ 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 }),
        status: status || 'planned',
        trackId: trackId || null,
      },
      include: {
        track: true,
        standings: true,
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
        standings: true,
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
        standings: {
          orderBy: {
            position: 'asc',
          },
        },
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
      include: {
        _count: {
          select: {
            sessions: true,
          },
        },
      },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Championship not found',
      });
    }

    if (exists._count.sessions > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete championship with ${exists._count.sessions} session(s). Delete sessions first or archive the championship.`,
      });
    }

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

// GET /api/championships/:id/standings - Récupère le classement d'un championnat
router.get('/:id/standings', async (req, res) => {
  try {
    const { id } = req.params;

    const standings = await prisma.championshipStanding.findMany({
      where: { championshipId: id },
      orderBy: {
        position: 'asc',
      },
    });

    res.json({
      success: true,
      data: standings,
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

// POST /api/championships/:id/recalculate - Recalcule le classement
router.post('/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params;

    const championship = await prisma.championship.findUnique({
      where: { id },
      include: {
        sessions: {
          where: {
            status: 'finished',
          },
          include: {
            drivers: {
              include: {
                driver: true,
              },
            },
            laps: true,
            phases: true,
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

    // Parse points system
    const pointsSystem = JSON.parse(championship.pointsSystem);

    // Calculer les stats par pilote
    const driverStats = {};

    const initDriver = (driverId) => {
      if (!driverStats[driverId]) {
        driverStats[driverId] = {
          points: 0,
          wins: 0,
          podiums: 0,
          qualifBestTime: null,
          raceTotalLaps: 0,
          raceTotalTime: 0,
        };
      }
    };

    championship.sessions.forEach(session => {
      // Points-based stats from session drivers
      session.drivers.forEach(sd => {
        if (sd.finalPos !== null) {
          const driverId = sd.driverId;
          initDriver(driverId);
          const points = pointsSystem[sd.finalPos] || 0;

          driverStats[driverId].points += points;
          if (sd.finalPos === 1) driverStats[driverId].wins++;
          if (sd.finalPos <= 3) driverStats[driverId].podiums++;
        }
      });

      // Time-based stats from laps
      session.laps.forEach(lap => {
        const driverId = lap.driverId;
        initDriver(driverId);

        const lapTimeMs = Math.round(lap.lapTime);

        // Qualifying: track best lap time
        if (lap.phase === 'qualif') {
          if (driverStats[driverId].qualifBestTime === null || lapTimeMs < driverStats[driverId].qualifBestTime) {
            driverStats[driverId].qualifBestTime = lapTimeMs;
          }
        }

        // Race: accumulate laps and time
        if (lap.phase === 'race') {
          driverStats[driverId].raceTotalLaps++;
          driverStats[driverId].raceTotalTime += lapTimeMs;
        }
      });
    });

    // Trier par points (puis victoires en cas d'égalité)
    const sortedDrivers = Object.entries(driverStats)
      .sort((a, b) => {
        if (b[1].points !== a[1].points) return b[1].points - a[1].points;
        return b[1].wins - a[1].wins;
      })
      .map(([driverId, stats], index) => ({
        driverId,
        position: index + 1,
        points: stats.points,
        wins: stats.wins,
        podiums: stats.podiums,
        qualifBestTime: stats.qualifBestTime,
        raceTotalLaps: stats.raceTotalLaps,
        raceTotalTime: stats.raceTotalTime,
      }));

    // Supprimer les anciens standings
    await prisma.championshipStanding.deleteMany({
      where: { championshipId: id },
    });

    // Créer les nouveaux standings
    await prisma.championshipStanding.createMany({
      data: sortedDrivers.map(s => ({
        championshipId: id,
        driverId: s.driverId,
        position: s.position,
        points: s.points,
        wins: s.wins,
        podiums: s.podiums,
        qualifBestTime: s.qualifBestTime,
        raceTotalLaps: s.raceTotalLaps,
        raceTotalTime: s.raceTotalTime,
      })),
    });

    // Retourner les nouveaux standings
    const newStandings = await prisma.championshipStanding.findMany({
      where: { championshipId: id },
      orderBy: {
        position: 'asc',
      },
    });

    res.json({
      success: true,
      data: newStandings,
    });
  } catch (error) {
    console.error('Error recalculating standings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate standings',
    });
  }
});

export default router;
