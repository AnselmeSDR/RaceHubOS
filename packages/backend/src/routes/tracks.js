import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/tracks - List all tracks
router.get('/', async (req, res) => {
  try {
    const tracks = await prisma.track.findMany({
      include: {
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      data: tracks.map(t => withImageUrl(t)),
      count: tracks.length,
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
          take: 10, // Last 10 sessions
          include: {
            drivers: {
              include: {
                driver: true,
              },
            },
          },
        },
      },
    });

    if (!track) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    res.json({
      success: true,
      data: withNestedImageUrls(track),
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

export default router;
