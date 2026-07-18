// ==================== SİPARİŞ YÖNETİM MERKEZİ V5.0 ====================
// DG STOK V5.0 - Tüm pazaryerleri için tek sipariş merkezi
// ====================================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

// ==================== SİPARİŞ İSTATİSTİKLERİ ====================

router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, todayNew, confirmed, preparing, shipped, delivered, cancelled, returned] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { status: 'approved' } }),
      prisma.order.count({ where: { status: 'preparing' } }),
      prisma.order.count({ where: { status: 'shipped' } }),
      prisma.order.count({ where: { status: 'delivered' } }),
      prisma.order.count({ where: { status: 'cancelled' } }),
      prisma.order.count({ where: { status: 'returned' } }),
    ]);

    const totalRevenue = await prisma.order.aggregate({ _sum: { total: true } });

    res.json({ total, todayNew, confirmed, preparing, shipped, delivered, cancelled, returned, totalRevenue: totalRevenue._sum.total || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order stats' });
  }
});

// ==================== SİPARİŞ LİSTELEME ====================

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const skip = (page - 1) * limit;
    const search = String(req.query.search ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const channel = String(req.query.channel ?? '').trim();
    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;

    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
        { trackingNo: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          marketplace: { select: { id: true, name: true, key: true } },
          shipments: { select: { id: true, cargoCompany: true, trackingNo: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ==================== SİPARİŞ DETAY ====================

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        marketplace: { select: { id: true, name: true, key: true } },
        shipments: true,
        financeRecords: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ==================== SİPARİŞ SENKRONİZASYON ====================

router.post('/sync', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { channel, orderIds } = req.body;

    // Simüle sync - gerçek entegrasyonda adapter üzerinden çekilir
    const marketplaceKey = channel || 'tt';
    const mp = await prisma.marketplace.findUnique({ where: { key: marketplaceKey } });

    await prisma.auditLog.create({
      data: {
        action: 'order.sync',
        entity: 'marketplace', entityId: mp?.id || null,
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        details: JSON.stringify({ channel: marketplaceKey, orderIds: orderIds || 'all' }),
      },
    });

    res.json({ ok: true, message: `Sipariş senkronizasyonu başlatıldı: ${marketplaceKey}` });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ==================== SİPARİŞ DURUM GÜNCELLE ====================

router.put('/:id/status', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { status, cargoCompany, trackingNo } = req.body;
    const data: Record<string, any> = {};
    if (status) data.status = status;
    if (cargoCompany) data.cargoCompany = cargoCompany;
    if (trackingNo) data.trackingNo = trackingNo;

    const oldOrder = await prisma.order.findUnique({ where: { id: req.params.id } });
    const order = await prisma.order.update({ where: { id: req.params.id }, data });

    // Kargo bilgisi varsa shipment oluştur
    if (cargoCompany && trackingNo && status === 'shipped') {
      await prisma.shipment.upsert({
        where: { id: `ship-${req.params.id}` },
        update: { cargoCompany, trackingNo, status: 'shipped' },
        create: { orderId: req.params.id, channel: order.channel, cargoCompany, trackingNo, status: 'shipped' },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'order.status.update',
        entity: 'order', entityId: req.params.id,
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        details: JSON.stringify({ oldStatus: oldOrder?.status, newStatus: status, cargoCompany, trackingNo }),
      },
    });

    res.json({ ok: true, item: order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==================== TOPLU İŞLEMLER ====================

router.post('/bulk', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });

    let result: { count: number } = { count: 0 };
    switch (action) {
      case 'set_status':
        result = await prisma.order.updateMany({ where: { id: { in: ids } }, data: { status: value } });
        break;
      case 'cancel':
        result = await prisma.order.updateMany({ where: { id: { in: ids }, status: { notIn: ['delivered', 'cancelled'] } }, data: { status: 'cancelled' } });
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    await prisma.auditLog.create({
      data: {
        action: `order.bulk.${action}`,
        entity: 'order',
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        details: JSON.stringify({ count: result.count, ids, action, value }),
      },
    });

    res.json({ ok: true, updatedCount: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Bulk operation failed' });
  }
});

export default router;
