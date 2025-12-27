import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/stats/drivers - Get driver statistics
router.get('/drivers', async (req, res) => {
  try {
    const { championshipId, trackId } = req.query;

    // Base query for drivers with their stats
    const drivers = await prisma.driver.findMany({
      include: {
        laps: championshipId || trackId ? {
          where: {
            session: {
              ...(championshipId && { championshipId }),
              ...(trackId && { trackId }),
            },
          },
        } : true,
        sessions: championshipId || trackId ? {
          where: {
            session: {
              ...(championshipId && { championshipId }),
              ...(trackId && { trackId }),
            },
          },
          include: {
            session: true,
          },
        } : {
          include: {
            session: true,
          },
        },
        team: true,
      },
    });

    // Calculate statistics for each driver
    const stats = drivers.map(driver => {
      const allLaps = driver.laps || [];
      const validLaps = allLaps.filter(lap => !lap.isPitLap);

      // Calculate best lap
      const bestLap = validLaps.length > 0
        ? Math.min(...validLaps.map(lap => lap.lapTime))
        : null;

      // Calculate average lap time
      const avgLapTime = validLaps.length > 0
        ? validLaps.reduce((sum, lap) => sum + lap.lapTime, 0) / validLaps.length
        : null;

      // Count races, wins, podiums
      const sessions = driver.sessions || [];
      const races = sessions.filter(sd => sd.session.type === 'race');
      const wins = races.filter(sd => sd.finalPos === 1).length;
      const podiums = races.filter(sd => sd.finalPos && sd.finalPos <= 3).length;

      return {
        id: driver.id,
        name: driver.name,
        number: driver.number,
        color: driver.color,
        ...withImageUrl({ img: driver.img }),
        team: withImageUrl(driver.team),
        statistics: {
          totalRaces: races.length,
          totalLaps: allLaps.length,
          wins,
          podiums,
          bestLap,
          avgLapTime,
          dnf: races.filter(sd => !sd.finalPos).length,
          polePositions: races.filter(sd => sd.gridPos === 1).length,
        },
      };
    });

    // Sort by wins, then podiums, then total races
    stats.sort((a, b) => {
      if (b.statistics.wins !== a.statistics.wins) {
        return b.statistics.wins - a.statistics.wins;
      }
      if (b.statistics.podiums !== a.statistics.podiums) {
        return b.statistics.podiums - a.statistics.podiums;
      }
      return b.statistics.totalRaces - a.statistics.totalRaces;
    });

    res.json({
      success: true,
      data: stats,
      filters: { championshipId, trackId },
    });
  } catch (error) {
    console.error('Error fetching driver statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver statistics',
    });
  }
});

// GET /api/stats/cars - Get car statistics
router.get('/cars', async (req, res) => {
  try {
    const { championshipId, trackId } = req.query;

    const cars = await prisma.car.findMany({
      include: {
        laps: championshipId || trackId ? {
          where: {
            session: {
              ...(championshipId && { championshipId }),
              ...(trackId && { trackId }),
            },
          },
        } : true,
        sessions: championshipId || trackId ? {
          where: {
            session: {
              ...(championshipId && { championshipId }),
              ...(trackId && { trackId }),
            },
          },
          include: {
            session: true,
          },
        } : {
          include: {
            session: true,
          },
        },
      },
    });

    const stats = cars.map(car => {
      const allLaps = car.laps || [];
      const validLaps = allLaps.filter(lap => !lap.isPitLap);

      const bestLap = validLaps.length > 0
        ? Math.min(...validLaps.map(lap => lap.lapTime))
        : null;

      const avgLapTime = validLaps.length > 0
        ? validLaps.reduce((sum, lap) => sum + lap.lapTime, 0) / validLaps.length
        : null;

      const sessions = car.sessions || [];
      const races = sessions.filter(sd => sd.session.type === 'race');
      const wins = races.filter(sd => sd.finalPos === 1).length;

      return {
        id: car.id,
        brand: car.brand,
        model: car.model,
        year: car.year,
        color: car.color,
        ...withImageUrl({ img: car.img }),
        statistics: {
          totalRaces: races.length,
          totalLaps: allLaps.length,
          wins,
          bestLap,
          avgLapTime,
          reliability: races.length > 0
            ? (races.filter(sd => sd.finalPos).length / races.length) * 100
            : 0,
        },
      };
    });

    stats.sort((a, b) => b.statistics.wins - a.statistics.wins);

    res.json({
      success: true,
      data: stats,
      filters: { championshipId, trackId },
    });
  } catch (error) {
    console.error('Error fetching car statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch car statistics',
    });
  }
});

// GET /api/stats/tracks - Get track statistics
router.get('/tracks', async (req, res) => {
  try {
    const tracks = await prisma.track.findMany({
      include: {
        sessions: {
          include: {
            laps: {
              orderBy: {
                lapTime: 'asc',
              },
              take: 1,
            },
            _count: {
              select: {
                laps: true,
              },
            },
          },
        },
      },
    });

    const stats = tracks.map(track => {
      const sessions = track.sessions || [];
      const allLaps = sessions.flatMap(s => s.laps || []);
      const bestLap = allLaps.length > 0
        ? Math.min(...allLaps.map(lap => lap.lapTime))
        : track.bestLap;

      return {
        id: track.id,
        name: track.name,
        color: track.color,
        ...withImageUrl({ img: track.img }),
        length: track.length,
        corners: track.corners,
        statistics: {
          totalSessions: sessions.length,
          totalLaps: sessions.reduce((sum, s) => sum + s._count.laps, 0),
          bestLap,
          bestLapBy: track.bestLapBy,
          avgSessionDuration: sessions.length > 0
            ? sessions.reduce((sum, s) => {
                if (s.startedAt && s.finishedAt) {
                  return sum + (new Date(s.finishedAt) - new Date(s.startedAt));
                }
                return sum;
              }, 0) / sessions.length / 60000 // Convert to minutes
            : null,
        },
      };
    });

    stats.sort((a, b) => b.statistics.totalSessions - a.statistics.totalSessions);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching track statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch track statistics',
    });
  }
});

// GET /api/stats/leaderboard/drivers - Get driver leaderboard
router.get('/leaderboard/drivers', async (req, res) => {
  try {
    const { sessionId, championshipId, phase, limit = 10 } = req.query;

    let leaderboard = [];

    if (sessionId) {
      // Get leaderboard for a specific session
      const sessionDrivers = await prisma.sessionDriver.findMany({
        where: { sessionId },
        include: {
          driver: true,
          car: true,
          session: {
            include: {
              laps: {
                where: {
                  sessionId,
                  ...(phase && { phase })
                },
              },
            },
          },
        },
        orderBy: [
          { finalPos: 'asc' },
          { position: 'asc' },
        ],
      });

      leaderboard = sessionDrivers.map(sd => {
        const driverLaps = sd.session.laps.filter(lap => lap.driverId === sd.driverId);
        const bestLap = driverLaps.length > 0
          ? Math.min(...driverLaps.map(lap => lap.lapTime))
          : null;

        return {
          position: sd.finalPos || sd.position || null,
          driver: withImageUrl(sd.driver),
          car: withImageUrl(sd.car),
          laps: driverLaps.length,
          bestLap,
          lastLap: driverLaps.length > 0
            ? driverLaps[driverLaps.length - 1].lapTime
            : null,
          gap: null, // Calculate gap to leader if needed
        };
      });

      // Sort by best lap for practice/qualif, by laps and best lap for race
      if (phase === 'practice' || phase === 'qualif') {
        leaderboard = leaderboard
          .filter(entry => entry.bestLap !== null)
          .sort((a, b) => a.bestLap - b.bestLap)
          .map((entry, index) => ({ ...entry, position: index + 1 }));
      } else if (phase === 'race') {
        leaderboard = leaderboard
          .sort((a, b) => {
            if (b.laps !== a.laps) return b.laps - a.laps;
            if (a.bestLap === null) return 1;
            if (b.bestLap === null) return -1;
            return a.bestLap - b.bestLap;
          })
          .map((entry, index) => ({ ...entry, position: index + 1 }));
      }
    } else if (championshipId) {
      // Championship standings are now calculated on-demand via GET /championships/:id/standings?type=
      // This endpoint returns empty for backwards compatibility
      leaderboard = [];
    } else {
      // Get overall leaderboard based on all-time stats
      const drivers = await prisma.driver.findMany({
        include: {
          sessions: {
            where: {
              session: {
                type: 'race',
              },
            },
          },
        },
        take: parseInt(limit),
      });

      const driverStats = drivers.map(driver => {
        const races = driver.sessions || [];
        const wins = races.filter(sd => sd.finalPos === 1).length;
        const podiums = races.filter(sd => sd.finalPos && sd.finalPos <= 3).length;

        return {
          driver,
          wins,
          podiums,
          races: races.length,
        };
      });

      driverStats.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.podiums !== a.podiums) return b.podiums - a.podiums;
        return b.races - a.races;
      });

      leaderboard = driverStats.map((stat, index) => ({
        position: index + 1,
        driver: withImageUrl(stat.driver),
        wins: stat.wins,
        podiums: stat.podiums,
        races: stat.races,
      }));
    }

    res.json({
      success: true,
      data: leaderboard,
      filters: { sessionId, championshipId, limit },
    });
  } catch (error) {
    console.error('Error fetching driver leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver leaderboard',
    });
  }
});

// GET /api/stats/leaderboard/teams - Get team leaderboard
router.get('/leaderboard/teams', async (req, res) => {
  try {
    const { championshipId } = req.query;

    const teams = await prisma.team.findMany({
      include: {
        drivers: {
          include: {
            sessions: championshipId ? {
              where: {
                session: {
                  championshipId,
                  type: 'race',
                },
              },
            } : {
              where: {
                session: {
                  type: 'race',
                },
              },
            },
          },
        },
      },
    });

    const teamStats = teams.map(team => {
      let totalPoints = 0;
      let totalWins = 0;
      let totalPodiums = 0;
      let totalRaces = 0;

      team.drivers.forEach(driver => {
        const races = driver.sessions || [];
        totalRaces += races.length;
        totalWins += races.filter(sd => sd.finalPos === 1).length;
        totalPodiums += races.filter(sd => sd.finalPos && sd.finalPos <= 3).length;

        // Simple point calculation (can be improved with actual championship points)
        races.forEach(sd => {
          if (sd.finalPos === 1) totalPoints += 25;
          else if (sd.finalPos === 2) totalPoints += 18;
          else if (sd.finalPos === 3) totalPoints += 15;
          else if (sd.finalPos === 4) totalPoints += 12;
          else if (sd.finalPos === 5) totalPoints += 10;
          else if (sd.finalPos === 6) totalPoints += 8;
          else if (sd.finalPos === 7) totalPoints += 6;
          else if (sd.finalPos === 8) totalPoints += 4;
          else if (sd.finalPos === 9) totalPoints += 2;
          else if (sd.finalPos === 10) totalPoints += 1;
        });
      });

      return {
        team,
        points: totalPoints,
        wins: totalWins,
        podiums: totalPodiums,
        races: totalRaces,
      };
    });

    teamStats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.podiums - a.podiums;
    });

    const leaderboard = teamStats.map((stat, index) => ({
      position: index + 1,
      team: withImageUrl(stat.team),
      points: stat.points,
      wins: stat.wins,
      podiums: stat.podiums,
      races: stat.races,
      gap: index > 0 ? teamStats[0].points - stat.points : null,
    }));

    res.json({
      success: true,
      data: leaderboard,
      filters: { championshipId },
    });
  } catch (error) {
    console.error('Error fetching team leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team leaderboard',
    });
  }
});

// GET /api/stats/records - Get all-time records
router.get('/records', async (req, res) => {
  try {
    // Get fastest lap ever
    const fastestLap = await prisma.lap.findFirst({
      where: {
        isPitLap: false,
      },
      orderBy: {
        lapTime: 'asc',
      },
      include: {
        driver: true,
        car: true,
        session: {
          include: {
            track: true,
          },
        },
      },
    });

    // Get most wins
    const driversWithWins = await prisma.driver.findMany({
      include: {
        sessions: {
          where: {
            finalPos: 1,
            session: {
              type: 'race',
            },
          },
        },
      },
    });

    const mostWinsDriver = driversWithWins.reduce((max, driver) => {
      const wins = driver.sessions.length;
      return wins > (max?.wins || 0) ? { driver, wins } : max;
    }, null);

    // Get most podiums
    const driversWithPodiums = await prisma.driver.findMany({
      include: {
        sessions: {
          where: {
            finalPos: {
              in: [1, 2, 3],
            },
            session: {
              type: 'race',
            },
          },
        },
      },
    });

    const mostPodiumsDriver = driversWithPodiums.reduce((max, driver) => {
      const podiums = driver.sessions.length;
      return podiums > (max?.podiums || 0) ? { driver, podiums } : max;
    }, null);

    // Get most pole positions
    const driversWithPoles = await prisma.driver.findMany({
      include: {
        sessions: {
          where: {
            gridPos: 1,
            session: {
              type: 'race',
            },
          },
        },
      },
    });

    const mostPolesDriver = driversWithPoles.reduce((max, driver) => {
      const poles = driver.sessions.length;
      return poles > (max?.poles || 0) ? { driver, poles } : max;
    }, null);

    res.json({
      success: true,
      data: {
        fastestLap: fastestLap ? {
          time: fastestLap.lapTime,
          driver: withImageUrl(fastestLap.driver),
          car: withImageUrl(fastestLap.car),
          track: withImageUrl(fastestLap.session.track),
          date: fastestLap.timestamp,
        } : null,
        mostWins: mostWinsDriver ? {
          driver: withImageUrl(mostWinsDriver.driver),
          count: mostWinsDriver.wins,
        } : null,
        mostPodiums: mostPodiumsDriver ? {
          driver: withImageUrl(mostPodiumsDriver.driver),
          count: mostPodiumsDriver.podiums,
        } : null,
        mostPolePositions: mostPolesDriver ? {
          driver: withImageUrl(mostPolesDriver.driver),
          count: mostPolesDriver.poles,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch records',
    });
  }
});

export default router;