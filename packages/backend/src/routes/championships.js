import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

let championshipService;

export function setChampionshipService(service) {
  championshipService = service;
}

// GET /api/championships - Liste tous les championnats
router.get('/', async (req, res) => {
  try {
    const { deleted, trackId, status, limit = '50', offset = '0', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
    if (trackId) where.trackId = trackId.includes(',') ? { in: trackId.split(',') } : trackId;
    if (status) where.status = status.includes(',') ? { in: status.split(',') } : status;

    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    const computedSorts = ['track', 'qualifs', 'races'];
    const useDbSort = !computedSorts.includes(sortBy);

    const [allChampionships, total] = await Promise.all([
      prisma.championship.findMany({
        where,
        include: {
          track: true,
          sessions: {
            where: { deletedAt: null },
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
        },
        orderBy: useDbSort ? { [sortBy]: sortOrder } : undefined,
      }),
      prisma.championship.count({ where }),
    ]);

    let sorted = allChampionships;
    if (!useDbSort) {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'track') {
        sorted = [...allChampionships].sort((a, b) => dir * (a.track?.name || '').localeCompare(b.track?.name || ''));
      } else if (sortBy === 'qualifs') {
        sorted = [...allChampionships].sort((a, b) => dir * ((a.sessions?.filter(s => s.type === 'qualif').length || 0) - (b.sessions?.filter(s => s.type === 'qualif').length || 0)));
      } else if (sortBy === 'races') {
        sorted = [...allChampionships].sort((a, b) => dir * ((a.sessions?.filter(s => s.type === 'race').length || 0) - (b.sessions?.filter(s => s.type === 'race').length || 0)));
      }
    }

    const championships = sorted.slice(parsedOffset, parsedOffset + parsedLimit);

    res.json({
      success: true,
      data: championships,
      total,
      hasMore: parsedOffset + parsedLimit < total,
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
      where: { id, deletedAt: null },
      include: {
        track: true,
        participants: {
          include: { driver: true },
          orderBy: { order: 'asc' },
        },
        sessions: {
          where: { deletedAt: null },
          include: {
            track: true,
            drivers: {
              where: { deletedAt: null },
              include: {
                driver: true,
                car: true,
              },
            },
            laps: {
              where: { deletedAt: null },
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
    const {
      name, season, pointsSystem, status, trackId,
      mode, driversPerQualif, driversPerRace,
      qualifMaxDuration, qualifMaxLaps, raceMaxDuration, raceMaxLaps,
      participants,
    } = req.body;

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

    // Auto mode validation
    if (mode === 'auto') {
      if (!trackId) {
        return res.status(400).json({ success: false, error: 'Track is required for auto championships' });
      }
      if (!participants || participants.length < 2) {
        return res.status(400).json({ success: false, error: 'At least 2 participants required' });
      }
      if (!driversPerQualif || driversPerQualif < 2 || driversPerQualif > 6) {
        return res.status(400).json({ success: false, error: 'driversPerQualif must be between 2 and 6' });
      }
      if (!driversPerRace || driversPerRace < 2 || driversPerRace > 6) {
        return res.status(400).json({ success: false, error: 'driversPerRace must be between 2 and 6' });
      }
    }

    const championship = await prisma.championship.create({
      data: {
        name: name.trim(),
        season: season.trim(),
        status: status || 'planned',
        trackId: trackId || null,
        mode: mode || 'manual',
        driversPerQualif: mode === 'auto' ? driversPerQualif : null,
        driversPerRace: mode === 'auto' ? driversPerRace : null,
        qualifMaxDuration: qualifMaxDuration || null,
        qualifMaxLaps: qualifMaxLaps || null,
        raceMaxDuration: raceMaxDuration || null,
        raceMaxLaps: raceMaxLaps || null,
      },
    });

    // Create participants for auto mode
    if (mode === 'auto' && participants?.length) {
      for (let i = 0; i < participants.length; i++) {
        await prisma.championshipParticipant.create({
          data: {
            championshipId: championship.id,
            driverId: participants[i].driverId,
            order: i,
          },
        });
      }
    }

    // Create permanent free practice session for this championship
    if (trackId) {
      await prisma.session.create({
        data: {
          name: 'Essais Libres',
          type: 'practice',
          status: 'draft',
          championshipId: championship.id,
          trackId,
        },
      });
    }

    // Generate auto sessions (qualifs + races)
    if (mode === 'auto') {
      await championshipService.generateAutoSessions(championship.id);
    }

    // Refetch with all relations
    const result = await prisma.championship.findUnique({
      where: { id: championship.id },
      include: {
        track: true,
        participants: { include: { driver: true }, orderBy: { order: 'asc' } },
        sessions: {
          where: { deletedAt: null },
          include: {
            drivers: { where: { deletedAt: null }, include: { driver: true, car: true } },
          },
          orderBy: { order: 'asc' },
        },
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

// DELETE /api/championships/:id - Soft delete or hard delete championship
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

    if (exists.deletedAt) {
      // Hard delete cascade: laps → session drivers → sessions → championship
      await prisma.$transaction([
        prisma.lap.deleteMany({ where: { session: { championshipId: id } } }),
        prisma.sessionDriver.deleteMany({ where: { session: { championshipId: id } } }),
        prisma.session.deleteMany({ where: { championshipId: id } }),
        prisma.championship.delete({ where: { id } }),
      ]);
    } else {
      // Soft delete cascade: laps → session drivers → sessions → championship
      const now = new Date();

      await prisma.lap.updateMany({
        where: { session: { championshipId: id }, deletedAt: null },
        data: { deletedAt: now },
      });

      await prisma.sessionDriver.updateMany({
        where: { session: { championshipId: id }, deletedAt: null },
        data: { deletedAt: now },
      });

      await prisma.session.updateMany({
        where: { championshipId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      await prisma.championship.update({
        where: { id },
        data: { deletedAt: now },
      });
    }

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

// PATCH /api/championships/:id/restore - Restore soft-deleted championship
router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const entity = await prisma.championship.findUnique({ where: { id } });
    if (!entity) return res.status(404).json({ success: false, error: 'Championship not found' });

    // Restore cascade: championship → sessions → session drivers → laps
    await prisma.championship.update({
      where: { id },
      data: { deletedAt: null },
    });

    await prisma.session.updateMany({
      where: { championshipId: id, deletedAt: entity.deletedAt },
      data: { deletedAt: null },
    });

    await prisma.sessionDriver.updateMany({
      where: { session: { championshipId: id }, deletedAt: entity.deletedAt },
      data: { deletedAt: null },
    });

    await prisma.lap.updateMany({
      where: { session: { championshipId: id }, deletedAt: entity.deletedAt },
      data: { deletedAt: null },
    });

    res.json({ success: true, message: 'Championship restored' });
  } catch (error) {
    console.error('Error restoring championship:', error);
    res.status(500).json({ success: false, error: 'Failed to restore championship' });
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

// GET /api/championships/:id/results - Championship results with podium, standings and awards
router.get('/:id/results', async (req, res) => {
  try {
    const { id } = req.params;

    const championship = await prisma.championship.findUnique({
      where: { id, deletedAt: null },
      include: {
        sessions: {
          where: { deletedAt: null },
          include: {
            drivers: { where: { deletedAt: null }, include: { driver: true, car: true } },
            laps: { where: { deletedAt: null }, include: { driver: true, car: true } },
          },
        },
      },
    });

    if (!championship) {
      return res.status(404).json({ success: false, error: 'Championship not found' });
    }

    const qualifSessions = championship.sessions.filter(s => s.type === 'qualif' && s.status === 'finished');
    const raceSessions = championship.sessions.filter(s => s.type === 'race' && s.status === 'finished');

    // --- Final standings (race-based) ---
    const raceStats = {};
    for (const session of raceSessions) {
      for (const sd of session.drivers) {
        if (!sd.driverId) continue;
        const key = sd.driverId;
        if (!raceStats[key]) {
          raceStats[key] = { driverId: sd.driverId, driver: withImageUrl(sd.driver), car: withImageUrl(sd.car), totalLaps: 0, totalTime: 0, finishedRaces: 0 };
        }
        raceStats[key].totalLaps += sd.totalLaps || 0;
        raceStats[key].totalTime += sd.totalTime || 0;
        if (!sd.isDNF && sd.totalLaps > 0) raceStats[key].finishedRaces++;
      }
    }
    const standings = Object.values(raceStats)
      .sort((a, b) => (b.totalLaps !== a.totalLaps) ? b.totalLaps - a.totalLaps : a.totalTime - b.totalTime)
      .map((entry, i) => ({ position: i + 1, ...entry }));

    const podium = standings.slice(0, 3);

    // --- Awards ---
    const awards = [];

    // Best lap overall
    let bestLapOverall = null;
    for (const session of championship.sessions) {
      if (session.status !== 'finished') continue;
      for (const lap of session.laps) {
        if (!bestLapOverall || lap.lapTime < bestLapOverall.lapTime) {
          bestLapOverall = { lapTime: Math.round(lap.lapTime), driver: withImageUrl(lap.driver), car: withImageUrl(lap.car), sessionName: session.name, sessionType: session.type };
        }
      }
    }
    if (bestLapOverall) awards.push({ id: 'best-lap', title: 'Meilleur tour', icon: 'timer', ...bestLapOverall });

    // Best qualifier
    let bestQualif = null;
    for (const session of qualifSessions) {
      for (const lap of session.laps) {
        if (!bestQualif || lap.lapTime < bestQualif.lapTime) {
          bestQualif = { lapTime: Math.round(lap.lapTime), driver: withImageUrl(lap.driver), car: withImageUrl(lap.car), sessionName: session.name };
        }
      }
    }
    if (bestQualif) awards.push({ id: 'best-qualif', title: 'Meilleur qualifié', icon: 'clock', ...bestQualif });

    // Best race lap (fastest in race sessions only)
    let bestRaceLap = null;
    for (const session of raceSessions) {
      for (const lap of session.laps) {
        if (!bestRaceLap || lap.lapTime < bestRaceLap.lapTime) {
          bestRaceLap = { lapTime: Math.round(lap.lapTime), driver: withImageUrl(lap.driver), car: withImageUrl(lap.car), sessionName: session.name };
        }
      }
    }
    if (bestRaceLap) awards.push({ id: 'best-race-lap', title: 'Plus rapide en course', icon: 'zap', ...bestRaceLap });

    // Biggest comeback: best qualif position vs race final position improvement
    if (qualifSessions.length > 0 && raceSessions.length > 0) {
      // Build qualif ranking
      const qualifBests = {};
      for (const session of qualifSessions) {
        for (const lap of session.laps) {
          if (!qualifBests[lap.driverId] || lap.lapTime < qualifBests[lap.driverId].time) {
            qualifBests[lap.driverId] = { time: lap.lapTime, driver: withImageUrl(lap.driver) };
          }
        }
      }
      const qualifRanking = Object.entries(qualifBests)
        .sort((a, b) => a[1].time - b[1].time)
        .map(([id], i) => ({ driverId: id, qualifPos: i + 1 }));

      let bestComeback = null;
      for (const s of standings) {
        const qp = qualifRanking.find(q => q.driverId === s.driverId);
        if (!qp) continue;
        const gain = qp.qualifPos - s.position;
        if (!bestComeback || gain > bestComeback.gain) {
          bestComeback = { gain, driver: s.driver, qualifPos: qp.qualifPos, racePos: s.position };
        }
      }
      if (bestComeback && bestComeback.gain > 0) {
        awards.push({ id: 'comeback', title: 'Plus gros comeback', icon: 'trending-up', driver: bestComeback.driver, gain: bestComeback.gain, qualifPos: bestComeback.qualifPos, racePos: bestComeback.racePos });
      }
    }


    // Most consistent: smallest std deviation of lap times in race (min 5 laps)
    let mostConsistent = null;
    for (const session of raceSessions) {
      const lapsByDriver = {};
      for (const lap of session.laps) {
        if (!lapsByDriver[lap.driverId]) lapsByDriver[lap.driverId] = { laps: [], driver: withImageUrl(lap.driver) };
        lapsByDriver[lap.driverId].laps.push(lap.lapTime);
      }
      for (const [driverId, data] of Object.entries(lapsByDriver)) {
        if (data.laps.length < 5) continue;
        // Remove outliers (top/bottom 10%)
        const sorted = [...data.laps].sort((a, b) => a - b);
        const trim = Math.max(1, Math.floor(sorted.length * 0.1));
        const trimmed = sorted.slice(trim, sorted.length - trim);
        const mean = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
        const variance = trimmed.reduce((s, v) => s + (v - mean) ** 2, 0) / trimmed.length;
        const stdDev = Math.sqrt(variance);
        if (!mostConsistent || stdDev < mostConsistent.stdDev) {
          mostConsistent = { stdDev: Math.round(stdDev), driver: data.driver, sessionName: session.name };
        }
      }
    }
    if (mostConsistent) awards.push({ id: 'consistent', title: 'Le plus régulier', icon: 'activity', driver: mostConsistent.driver, stdDev: mostConsistent.stdDev, sessionName: mostConsistent.sessionName });

    // Iron man: most total laps across all race sessions
    if (standings.length > 0) {
      const ironMan = standings.reduce((best, entry) => (!best || entry.totalLaps > best.totalLaps) ? entry : best, null);
      if (ironMan) awards.push({ id: 'iron-man', title: 'Le plus endurant', icon: 'heart', driver: ironMan.driver, totalLaps: ironMan.totalLaps, finishedRaces: ironMan.finishedRaces });
    }

    res.json({ success: true, data: { podium, standings, awards } });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch results' });
  }
});

// GET /api/championships/:id/bracket - Get bracket data for auto championship
router.get('/:id/bracket', async (req, res) => {
  try {
    const bracket = await championshipService.getBracket(req.params.id);
    if (!bracket) {
      return res.status(404).json({ success: false, error: 'Championship not found or not in auto mode' });
    }
    res.json({ success: true, data: bracket });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bracket' });
  }
});

// PUT /api/championships/:id/participants - Update participants
router.put('/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const { participants } = req.body;

    const championship = await prisma.championship.findUnique({
      where: { id, deletedAt: null },
      include: {
        sessions: { where: { deletedAt: null } },
        participants: { orderBy: { order: 'asc' } },
      },
    });

    if (!championship) {
      return res.status(404).json({ success: false, error: 'Championship not found' });
    }
    if (championship.mode !== 'auto') {
      return res.status(400).json({ success: false, error: 'Only auto championships support participants' });
    }
    if (!participants || participants.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 participants required' });
    }

    const hasStartedQualif = championship.sessions.some(s => s.type === 'qualif' && s.status !== 'draft');

    // Cannot remove participants who already raced in a non-draft session
    if (hasStartedQualif) {
      const existingIds = new Set(championship.participants.map(p => p.driverId));
      const newIds = new Set(participants.map(p => p.driverId));
      const startedDriverIds = new Set();
      for (const session of championship.sessions) {
        if (session.type === 'qualif' && session.status !== 'draft') {
          const drivers = await prisma.sessionDriver.findMany({ where: { sessionId: session.id, deletedAt: null } });
          drivers.forEach(d => { if (d.driverId) startedDriverIds.add(d.driverId); });
        }
      }
      for (const dId of startedDriverIds) {
        if (!newIds.has(dId)) {
          return res.status(400).json({ success: false, error: `Cannot remove driver who already participated in a qualif` });
        }
      }
    }

    // Replace participants
    await prisma.championshipParticipant.deleteMany({ where: { championshipId: id } });
    for (let i = 0; i < participants.length; i++) {
      await prisma.championshipParticipant.create({
        data: {
          championshipId: id,
          driverId: participants[i].driverId,
          order: i,
        },
      });
    }

    if (!hasStartedQualif) {
      // No qualif started: regenerate all sessions
      await championshipService.generateAutoSessions(id);
    }
    // If qualifs already started, new participants need a manual qualif session (user adds via UI)

    const result = await prisma.championship.findUnique({
      where: { id },
      include: {
        participants: { include: { driver: true }, orderBy: { order: 'asc' } },
        sessions: {
          where: { deletedAt: null },
          include: { drivers: { where: { deletedAt: null }, include: { driver: true, car: true } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating participants:', error);
    res.status(500).json({ success: false, error: 'Failed to update participants' });
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
      where: { id, deletedAt: null },
      include: {
        sessions: {
          where: {
            deletedAt: null,
            ...(type === 'practice' ? { type: 'practice' } : {
              type: type === 'qualif' ? 'qualif' : 'race',
              status: 'finished'
            }),
          },
          include: {
            drivers: {
              where: { deletedAt: null },
              include: { driver: true, car: true }
            },
            laps: type !== 'race' ? {
              where: type === 'qualif' ? { deletedAt: null } : undefined,
              include: { driver: true, car: true }
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
      // Qualifying standings: MIN(lapTime) grouped by driverId + carId
      const stats = {};

      championship.sessions.forEach(session => {
        session.laps.forEach(lap => {
          const key = `${lap.driverId}-${lap.carId}`;
          const lapTimeMs = Math.round(lap.lapTime);
          if (!stats[key]) {
            stats[key] = {
              driverId: lap.driverId,
              carId: lap.carId,
              driver: withImageUrl(lap.driver),
              car: withImageUrl(lap.car),
              bestTime: Infinity,
              totalLaps: 0
            };
          }
          stats[key].totalLaps++;
          if (lapTimeMs < stats[key].bestTime) {
            stats[key].bestTime = lapTimeMs;
          }
        });
      });

      standings = Object.values(stats)
        .filter(entry => entry.bestTime !== Infinity)
        .sort((a, b) => a.bestTime - b.bestTime)
        .map((entry, index) => ({
          position: index + 1,
          driverId: entry.driverId,
          carId: entry.carId,
          driver: entry.driver,
          car: entry.car,
          bestTime: entry.bestTime,
          totalLaps: entry.totalLaps
        }));

    } else if (type === 'race') {
      // Race standings: SUM(totalLaps), SUM(totalTime) grouped by driverId + carId
      const stats = {};

      championship.sessions.forEach(session => {
        session.drivers.forEach(sd => {
          const key = `${sd.driverId}-${sd.carId}`;
          if (!stats[key]) {
            stats[key] = {
              driverId: sd.driverId,
              carId: sd.carId,
              driver: withImageUrl(sd.driver),
              car: withImageUrl(sd.car),
              totalLaps: 0,
              totalTime: 0,
              finishedRaces: 0
            };
          }
          stats[key].totalLaps += sd.totalLaps || 0;
          stats[key].totalTime += sd.totalTime || 0;
          if (!sd.isDNF && sd.totalLaps > 0) {
            stats[key].finishedRaces++;
          }
        });
      });

      standings = Object.values(stats)
        .sort((a, b) => {
          // More laps = better
          if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps;
          // Same laps: less time = better
          return a.totalTime - b.totalTime;
        })
        .map((entry, index) => ({
          position: index + 1,
          driverId: entry.driverId,
          carId: entry.carId,
          driver: entry.driver,
          car: entry.car,
          totalLaps: entry.totalLaps,
          totalTime: entry.totalTime,
          finishedRaces: entry.finishedRaces
        }));

    } else if (type === 'practice') {
      // Practice standings: MIN(lapTime) grouped by driverId + carId (includes soft-deleted laps)
      const practiceSession = championship.sessions[0];

      if (!practiceSession) {
        return res.json({
          success: true,
          type: 'practice',
          standings: [],
          count: 0
        });
      }

      const stats = {};

      practiceSession.laps.forEach(lap => {
        const key = `${lap.driverId}-${lap.carId}`;
        const lapTimeMs = Math.round(lap.lapTime);
        if (!stats[key]) {
          stats[key] = {
            driverId: lap.driverId,
            carId: lap.carId,
            driver: withImageUrl(lap.driver),
            car: withImageUrl(lap.car),
            bestTime: Infinity,
            totalLaps: 0
          };
        }
        stats[key].totalLaps++;
        if (lapTimeMs < stats[key].bestTime) {
          stats[key].bestTime = lapTimeMs;
        }
      });

      standings = Object.values(stats)
        .filter(entry => entry.bestTime !== Infinity)
        .sort((a, b) => a.bestTime - b.bestTime)
        .map((entry, index) => ({
          position: index + 1,
          driverId: entry.driverId,
          carId: entry.carId,
          driver: entry.driver,
          car: entry.car,
          bestTime: entry.bestTime,
          totalLaps: entry.totalLaps
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
