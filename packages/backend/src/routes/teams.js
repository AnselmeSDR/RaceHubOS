import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/teams - List all teams
router.get('/', async (req, res) => {
  try {
    const { deleted, limit = '50', offset = '0', sortBy = 'name', sortOrder = 'asc' } = req.query;
    const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        include: {
          drivers: {
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
          },
          _count: {
            select: {
              drivers: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: sortBy === 'drivers' ? { drivers: { _count: sortOrder } } : { [sortBy]: sortOrder },
        skip: parsedOffset,
        take: parsedLimit,
      }),
      prisma.team.count({ where }),
    ]);

    res.json({
      success: true,
      data: teams.map(t => withNestedImageUrls(t)),
      total,
      hasMore: parsedOffset + parsedLimit < total,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teams',
    });
  }
});

// GET /api/teams/:id - Get team by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        drivers: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
      });
    }

    res.json({
      success: true,
      data: withNestedImageUrls(team),
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team',
    });
  }
});

// POST /api/teams - Create new team
router.post('/', async (req, res) => {
  try {
    const { name, color, img } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        color: color || null,
        img: img || null,
      },
      include: {
        drivers: true,
      },
    });

    res.status(201).json({
      success: true,
      data: withNestedImageUrls(team),
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create team',
    });
  }
});

// PUT /api/teams/:id - Update team
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, img } = req.body;

    // Check if team exists
    const exists = await prisma.team.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
      });
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (img !== undefined) updateData.img = img;

    const team = await prisma.team.update({
      where: { id },
      data: updateData,
      include: {
        drivers: true,
      },
    });

    res.json({
      success: true,
      data: withNestedImageUrls(team),
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update team',
    });
  }
});

// DELETE /api/teams/:id - Delete team
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if team exists
    const exists = await prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            drivers: true,
          },
        },
      },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Team not found',
      });
    }

    // Warn if team has drivers
    if (exists._count.drivers > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete team with ${exists._count.drivers} driver(s). Please reassign or delete drivers first.`,
      });
    }

    await prisma.team.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete team',
    });
  }
});

export default router;
