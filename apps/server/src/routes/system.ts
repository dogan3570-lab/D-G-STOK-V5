// ==================== ENTERPRISE CONTROL CENTER V5.0 ====================
// DG STOK V5.0 - Sistem Yönetim Merkezi
// Health, Backup, Scheduler, Audit, Lisans
// ====================================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import os from 'os';

const router = Router();

// ==================== SİSTEM SAĞLIĞI ====================

router.get('/health', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (_req: Request, res: Response) => {
  try {
    // Veritabanı sağlığı
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // Sistem kaynakları
    const cpuLoad = os.loadavg()[0] || 0;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);

    // Queue sağlığı (basit kontrol)
    const queueCount = await prisma.queueJob.count();

    // Worker durumu
    const workerStatus = process.env.ENABLE_WORKERS === 'true' ? 'active' : 'disabled';

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      database: { connected: true, latency: dbLatency },
      system: { cpu: cpuLoad.toFixed(2), memory: `${memUsage}%`, platform: os.platform(), hostname: os.hostname() },
      queue: { jobs: queueCount, status: workerStatus },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: String(error) });
  }
});

// ==================== AUDIT LOG ====================

router.get('/audit', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const action = String(req.query.action ?? '').trim();
    const actorId = String(req.query.actorId ?? '').trim();
    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;

    const where: Record<string, any> = {};
    if (action) where.action = { contains: action };
    if (actorId) where.actorUserId = actorId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: { actorUser: { select: { id: true, email: true, name: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ==================== SİSTEM İSTATİSTİKLERİ ====================

router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [users, products, orders, marketplaces, xmlSources, auditLogs, notifications] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.marketplace.count(),
      prisma.xmlSource.count(),
      prisma.auditLog.count(),
      prisma.notification.count({ where: { read: false } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayAudit = await prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } });

    res.json({
      users, products, orders, marketplaces, xmlSources,
      auditLogs, unreadNotifications: notifications,
      todayAudit,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// ==================== BİLDİRİMLER ====================

router.get('/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(10, Number(req.query.limit ?? 20)));
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.notification.count(),
      prisma.notification.count({ where: { read: false } }),
    ]);
    res.json({ items, unread, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/read-all', requireAuth, async (_req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ==================== YEDEKLEME (MOCK) ====================

router.post('/backup', requireAuth, requireRole(['SUPER_ADMIN']), async (req: Request, res: Response) => {
  try {
    const type = String(req.body.type || 'full');

    await prisma.auditLog.create({
      data: {
        action: 'system.backup',
        entity: 'system',
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        details: JSON.stringify({ type, timestamp: new Date().toISOString() }),
      },
    });

    res.json({ ok: true, message: `Backup başlatıldı: ${type}`, type, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

// ==================== SCHEDULER ====================

router.get('/scheduler', requireAuth, async (_req: Request, res: Response) => {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ items: rules, count: rules.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scheduler' });
  }
});

export default router;
