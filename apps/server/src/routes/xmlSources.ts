import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../auth/authMiddleware';

const router = Router();

// GET /xml-sources - List all XML sources
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const sources = await prisma.xmlSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { importRuns: true },
        },
      },
    });

    const items = sources.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      url: source.url,
      active: source.active,
      scheduleIntervalMinutes: source.scheduleIntervalMinutes,
      lastRunAt: source.lastRunAt,
      lastSuccessAt: source.lastSuccessAt,
      lastError: source.lastError,
      productCount: source._count.importRuns,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    }));

    res.json({ items });
  } catch (error) {
    console.error('Error fetching XML sources:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XML sources' } });
  }
});

// GET /xml-sources/:id - Get single XML source
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({
      where: { id },
      include: {
        importRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    res.json(source);
  } catch (error) {
    console.error('Error fetching XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XML source' } });
  }
});

// POST /xml-sources - Create new XML source
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, sourceType, url, scheduleIntervalMinutes } = req.body;

    if (!name || !sourceType) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name and sourceType are required' } });
    }

    const source = await prisma.xmlSource.create({
      data: {
        name,
        sourceType,
        url: url || null,
        scheduleIntervalMinutes: scheduleIntervalMinutes || 60,
        active: true,
      },
    });

    res.status(201).json(source);
  } catch (error) {
    console.error('Error creating XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create XML source' } });
  }
});

// PUT /xml-sources/:id - Update XML source
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sourceType, url, active, scheduleIntervalMinutes } = req.body;

    const source = await prisma.xmlSource.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sourceType !== undefined && { sourceType }),
        ...(url !== undefined && { url }),
        ...(active !== undefined && { active }),
        ...(scheduleIntervalMinutes !== undefined && { scheduleIntervalMinutes }),
      },
    });

    res.json(source);
  } catch (error) {
    console.error('Error updating XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update XML source' } });
  }
});

// DELETE /xml-sources/:id - Delete XML source
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.xmlSource.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete XML source' } });
  }
});

// POST /xml-sources/:id/sync - Manual sync trigger
router.post('/:id/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({
      where: { id },
    });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    if (!source.url) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Source URL is required for sync' } });
    }

    // TODO: Implement actual sync logic with queue
    // For now, return success
    res.json({ message: 'Sync triggered', sourceId: source.id });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to trigger sync' } });
  }
});

// GET /xml-sources/:id/history - Get sync history
router.get('/:id/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const runs = await prisma.xmlImportRun.findMany({
      where: { sourceId: id },
      orderBy: { startedAt: 'desc' },
      take: Number(limit),
    });

    res.json({ items: runs });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sync history' } });
  }
});

export default router;
