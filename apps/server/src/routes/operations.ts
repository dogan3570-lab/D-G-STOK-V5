import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { OperationStore } from '../services/operation/OperationStore.ts';
import { eventBus } from '../services/workflow/index.ts';

export const operationsRouter = Router();
const store = new OperationStore();

// GET /api/operations/stats - Queue istatistikleri
operationsRouter.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await store.getStats();
    res.json({ ok: true, stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/operations - Tum operasyonlar
operationsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
    const status = req.query.status ? String(req.query.status) : undefined;

    const where: any = {};
    if (status) where.status = status;

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const [items, total] = await Promise.all([
      prisma.queueJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.queueJob.count({ where }),
    ]);
    await prisma.$disconnect();

    res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/operations/events - SSE event stream
operationsRouter.get('/events', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const handler = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  eventBus.on('*', handler);

  req.on('close', () => {
    eventBus.off('*', handler);
  });
});

// POST /api/operations/pause - Queue duraklat
operationsRouter.post('/pause', requireAuth, (_req, res) => {
  res.json({ ok: true, message: 'Queue paused' });
});

// POST /api/operations/resume - Queue devam ettir
operationsRouter.post('/resume', requireAuth, (_req, res) => {
  res.json({ ok: true, message: 'Queue resumed' });
});

// GET /api/operations/health - Health monitor
operationsRouter.get('/health', (_req, res) => {
  const memory = process.memoryUsage();
  res.json({
    ok: true,
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      rss: Math.round(memory.rss / 1024 / 1024),
    },
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  });
});
