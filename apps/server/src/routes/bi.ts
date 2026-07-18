// ==================== BUSINESS INTELLIGENCE & REPORTING V5.0 ====================
// DG STOK V5.0 - Enterprise BI Center
// Tüm KPI'lar Dashboard ile aynı veri kaynağını kullanır
// =============================================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';

const router = Router();

// ==================== YÖNETİCİ KPI'LARI ====================

router.get('/kpi', requireAuth, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProducts, activeProducts, errorProducts, readyProducts,
      pendingCategory, pendingBrand, pendingVariant, missingBarcode, missingImage,
      todayOrders, monthOrders, totalOrders,
      todayRevenue, monthRevenue, totalRevenue,
      cancelledOrders, returnedOrders,
      totalXmlSources, xmlErrorSources, totalImports, failedImports,
      marketplaces,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: { notIn: ['PASSIVE', 'ERROR'] } } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.product.count({ where: { categoryMatch: true, brandMatch: true, variantMatch: true, barcode: { not: null }, salePrice: { gt: 0 }, images: { not: null }, stock: { gt: 0 } } }),
      prisma.product.count({ where: { categoryId: null } }),
      prisma.product.count({ where: { brandMatch: false } }),
      prisma.product.count({ where: { variantMatch: false } }),
      prisma.product.count({ where: { barcode: null } }),
      prisma.product.count({ where: { images: null } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { total: true } }),
      prisma.order.aggregate({ _sum: { total: true } }),
      prisma.order.count({ where: { status: 'cancelled' } }),
      prisma.order.count({ where: { status: 'returned' } }),
      prisma.xmlSource.count(),
      prisma.xmlSource.count({ where: { connectionStatus: 'error' } }),
      prisma.xmlImportRun.count(),
      prisma.xmlImportRun.count({ where: { status: 'error' } }),
      prisma.marketplace.findMany({ select: { id: true, key: true, name: true, apiStatus: true } }),
    ]);

    const mpStats = await Promise.all(marketplaces.map(async mp => {
      const [sent, failed, pending] = await Promise.all([
        prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'SENT' } }),
        prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'ERROR' } }),
        prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: { in: ['READY', 'SENDING'] } } }),
      ]);
      return { key: mp.key, name: mp.name, status: mp.apiStatus, sent, failed, pending };
    }));

    res.json({
      products: { total: totalProducts, active: activeProducts, error: errorProducts, ready: readyProducts, pendingCategory, pendingBrand, pendingVariant, missingBarcode, missingImage },
      orders: { today: todayOrders, thisMonth: monthOrders, total: totalOrders, cancelled: cancelledOrders, returned: returnedOrders },
      revenue: { today: todayRevenue._sum.total || 0, thisMonth: monthRevenue._sum.total || 0, total: totalRevenue._sum.total || 0 },
      xml: { sources: totalXmlSources, errors: xmlErrorSources, imports: totalImports, failed: failedImports, successRate: totalImports > 0 ? Math.round(((totalImports - failedImports) / totalImports) * 100) : 100 },
      marketplaces: mpStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BI] KPI error:', error);
    res.status(500).json({ error: 'KPI hesaplanamadı' });
  }
});

// ==================== SATIŞ RAPORU ====================

router.get('/sales', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)));
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: dateFrom } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, total: true, status: true, channel: true },
    });

    // Günlük gruplama
    const daily: Record<string, { count: number; revenue: number; orders: any[] }> = {};
    for (const order of orders) {
      const day = order.createdAt.toISOString().slice(0, 10);
      if (!daily[day]) daily[day] = { count: 0, revenue: 0, orders: [] };
      daily[day].count++;
      daily[day].revenue += order.total || 0;
      daily[day].orders.push(order);
    }

    // Kanal bazlı
    const byChannel: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const ch = order.channel || 'unknown';
      if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 };
      byChannel[ch].count++;
      byChannel[ch].revenue += order.total || 0;
    }

    res.json({
      total: orders.length,
      totalRevenue: orders.reduce((s, o) => s + (o.total || 0), 0),
      totalCancelled: orders.filter(o => o.status === 'cancelled').length,
      daily: Object.entries(daily).map(([date, data]) => ({ date, ...data, orders: undefined })),
      byChannel: Object.entries(byChannel).map(([channel, data]) => ({ channel, ...data })),
      dateFrom: dateFrom.toISOString(),
      dateTo: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Sales report failed' });
  }
});

// ==================== STOK RAPORU ====================

router.get('/stock', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [outOfStock, lowStock, healthy] = await Promise.all([
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: 5 } } }),
      prisma.product.count({ where: { stock: { gt: 5 } } }),
    ]);

    const criticalProducts = await prisma.product.findMany({
      where: { stock: { gt: 0, lte: 3 } },
      orderBy: { stock: 'asc' },
      take: 20,
      select: { id: true, title: true, sku: true, stock: true, barcode: true, xmlSource: { select: { name: true } } },
    });

    res.json({ outOfStock, lowStock, healthy, total: outOfStock + lowStock + healthy, criticalProducts });
  } catch (error) {
    res.status(500).json({ error: 'Stock report failed' });
  }
});

// ==================== XML RAPORU ====================

router.get('/xml', requireAuth, async (_req: Request, res: Response) => {
  try {
    const sources = await prisma.xmlSource.findMany({
      select: {
        id: true, name: true, company: true, sourceType: true, connectionStatus: true,
        active: true, lastRunAt: true, lastSuccessAt: true, lastError: true,
        _count: { select: { products: true, importRuns: true } },
      },
      orderBy: { lastRunAt: 'desc' },
    });

    const sourceStats = await Promise.all(sources.map(async s => {
      const lastRun = await prisma.xmlImportRun.findFirst({
        where: { sourceId: s.id },
        orderBy: { startedAt: 'desc' },
        select: { status: true, newProducts: true, updatedProducts: true, failedProducts: true, durationMs: true },
      });
      return { ...s, lastRun };
    }));

    const [totalImports, successImports, failedImports] = await Promise.all([
      prisma.xmlImportRun.count(),
      prisma.xmlImportRun.count({ where: { status: 'completed' } }),
      prisma.xmlImportRun.count({ where: { status: 'error' } }),
    ]);

    res.json({
      sources: sourceStats,
      summary: { total: totalImports, success: successImports, failed: failedImports, successRate: totalImports > 0 ? Math.round((successImports / totalImports) * 100) : 100 },
    });
  } catch (error) {
    res.status(500).json({ error: 'XML report failed' });
  }
});

// ==================== DÖVİZ KURU (MOCK) ====================

router.get('/exchange-rates', requireAuth, async (_req: Request, res: Response) => {
  res.json({
    rates: { USD: 30.5, EUR: 33.2, GBP: 38.7, CHF: 35.1 },
    timestamp: new Date().toISOString(),
  });
});

export default router;
