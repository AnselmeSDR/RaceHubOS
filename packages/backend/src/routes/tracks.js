import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/tracks - List all tracks
router.get('/', async (req, res) => {
  try {
    const { deleted, limit = '50', offset = '0', sortBy = 'name', sortOrder = 'asc' } = req.query;
    const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where,
        include: {
          _count: {
            select: {
              sessions: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: sortBy === 'sessions' ? { sessions: { _count: sortOrder } } : { [sortBy]: sortOrder },
        skip: parsedOffset,
        take: parsedLimit,
      }),
      prisma.track.count({ where }),
    ]);

    res.json({
      success: true,
      data: tracks.map(t => withImageUrl(t)),
      total,
      hasMore: parsedOffset + parsedLimit < total,
    });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tracks',
    });
  }
});

// GET /api/tracks/:id - Get track by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const track = await prisma.track.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
          include: {
            _count: { select: { drivers: true } },
          },
        },
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!track) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    // Get best laps per driver x car combo on this track (top 10)
    const bestLaps = await prisma.lap.findMany({
      where: { trackId: id },
      orderBy: { lapTime: 'asc' },
      distinct: ['driverId', 'carId'],
      take: 10,
      include: {
        driver: {
          select: { id: true, name: true, color: true, img: true },
        },
        car: {
          select: { id: true, brand: true, model: true, color: true, img: true },
        },
        session: {
          select: { type: true },
        },
      },
    });

    const records = bestLaps.map((lap) => ({
      id: lap.id,
      lapTime: lap.lapTime,
      driver: lap.driver,
      car: lap.car,
      sessionType: lap.session?.type,
    }));

    const result = {
      ...track,
      records,
    };

    res.json({
      success: true,
      data: withNestedImageUrls(result),
    });
  } catch (error) {
    console.error('Error fetching track:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch track',
    });
  }
});

// POST /api/tracks - Create new track
router.post('/', async (req, res) => {
  try {
    const {
      name,
      img,
      layout,
      length,
      corners,
      color,
    } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    const track = await prisma.track.create({
      data: {
        name: name.trim(),
        img: img || null,
        layout: layout || null,
        length: length || null,
        corners: corners || null,
        color: color || '#9333ea',
      },
    });

    res.status(201).json({
      success: true,
      data: withImageUrl(track),
    });
  } catch (error) {
    console.error('Error creating track:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create track',
    });
  }
});

// PUT /api/tracks/:id - Update track
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      img,
      layout,
      length,
      corners,
      color,
      bestLap,
      bestLapBy,
    } = req.body;

    // Check if track exists
    const exists = await prisma.track.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (img !== undefined) updateData.img = img;
    if (layout !== undefined) updateData.layout = layout;
    if (length !== undefined) updateData.length = length;
    if (corners !== undefined) updateData.corners = corners;
    if (color !== undefined) updateData.color = color;
    if (bestLap !== undefined) updateData.bestLap = bestLap;
    if (bestLapBy !== undefined) updateData.bestLapBy = bestLapBy;

    const track = await prisma.track.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: withImageUrl(track),
    });
  } catch (error) {
    console.error('Error updating track:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update track',
    });
  }
});

// DELETE /api/tracks/:id - Delete track
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if track exists
    const exists = await prisma.track.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    await prisma.track.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Track deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting track:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete track',
    });
  }
});

// POST /api/tracks/:id/reset-stats - Reset track statistics
router.post('/:id/reset-stats', async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await prisma.track.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    // Delete related data and reset stats in a transaction
    const track = await prisma.$transaction(async (tx) => {
      // Delete track records
      await tx.trackRecord.deleteMany({ where: { trackId: id } });
      // Delete laps on this track
      await tx.lap.deleteMany({ where: { trackId: id } });

      // Reset stats fields
      return tx.track.update({
        where: { id },
        data: {
          bestLap: null,
          bestLapBy: null,
        },
        include: {
          _count: { select: { sessions: true } },
        },
      });
    });

    res.json({
      success: true,
      data: withImageUrl(track),
      message: 'Statistics reset successfully',
    });
  } catch (error) {
    console.error('Error resetting track stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset track statistics',
    });
  }
});

export default router;
