// ==================== HEPSIBURADA API PRODUCTION ENGINE V5 ====================
// DG STOK V5.0 - Hepsiburada Merchant API Entegrasyonu
// Trendyol'dan bağımsız, kendi adapter yapısında
// ===========================================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

// ==================== DURUM ====================

router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const mp = await prisma.marketplace.findUnique({ where: { key: 'he' } });
    if (!mp) return res.json({ connected: false, status: 'not_configured' });

    const [sentCount, errorCount, pendingCount] = await Promise.all([
      prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'SENT' } }),
      prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'ERROR' } }),
      prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: { in: ['READY', 'SENDING'] } } }),
    ]);

    res.json({
      connected: mp.apiStatus === 'ok' || mp.apiStatus === 'connected',
      status: mp.apiStatus,
      merchantId: mp.merchantId ? mp.merchantId.slice(0, 4) + '****' : null,
      lastTestAt: mp.updatedAt,
      stats: { sentCount, errorCount, pendingCount },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Hepsiburada status' });
  }
});

// ==================== TEST ====================

router.post('/test', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const mp = await prisma.marketplace.findUnique({ where: { key: 'he' } });
    if (!mp || !mp.apiKey || !mp.apiSecret) {
      return res.json({ ok: false, message: 'Hepsiburada API bilgileri eksik' });
    }

    try {
      const testUrl = `${mp.apiUrl || 'https://api.hepsiburada.com'}/merchant-info`;
      const auth = Buffer.from(`${mp.apiKey}:${mp.apiSecret}`).toString('base64');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(testUrl, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let apiStatus = 'error';
      if (response.ok) apiStatus = 'ok';
      else if (response.status === 401 || response.status === 403) apiStatus = 'unauthorized';
      else if (response.status === 429) apiStatus = 'rate_limited';

      await prisma.marketplace.update({
        where: { id: mp.id },
        data: { apiStatus },
      });

      await prisma.auditLog.create({
        data: {
          action: 'hepsiburada.test',
          entity: 'marketplace',
          entityId: mp.id,
          actorUserId: (req as AuthedRequest).actor?.userId ?? null,
          details: JSON.stringify({ httpStatus: response.status }),
        },
      });

      res.json({
        ok: response.ok,
        status: apiStatus,
        httpStatus: response.status,
        message: response.ok ? '✅ Bağlantı başarılı' : `❌ HTTP ${response.status}`,
      });
    } catch (fetchError: any) {
      const isTimeout = fetchError.name === 'AbortError';
      await prisma.marketplace.update({
        where: { id: mp.id },
        data: { apiStatus: isTimeout ? 'timeout' : 'error' },
      });
      res.json({ ok: false, status: isTimeout ? 'timeout' : 'error', message: isTimeout ? '⏱ Zaman aşımı' : `❌ ${fetchError.message}` });
    }
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Test başarısız' });
  }
});

// ==================== AYARLAR ====================

router.put('/settings', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { apiKey, apiSecret, merchantId } = req.body;
    const data: Record<string, any> = {};
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (apiSecret !== undefined) data.apiSecret = apiSecret;
    if (merchantId !== undefined) data.merchantId = merchantId;

    const existing = await prisma.marketplace.findUnique({ where: { key: 'he' } });
    const mp = existing
      ? await prisma.marketplace.update({ where: { key: 'he' }, data })
      : await prisma.marketplace.create({
          data: { key: 'he', name: 'Hepsiburada', apiStatus: 'unknown', apiUrl: 'https://api.hepsiburada.com', ...data },
        });

    await prisma.auditLog.create({
      data: {
        action: 'hepsiburada.settings.update',
        entity: 'marketplace', entityId: mp.id,
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        details: JSON.stringify({ hasKey: !!apiKey, hasSecret: !!apiSecret }),
      },
    });

    res.json({ ok: true, message: '✅ Hepsiburada ayarları güncellendi' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Ayarlar güncellenemedi' });
  }
});

// ==================== GÖNDERİM ====================

router.post('/send', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds required' });
    }

    const mp = await prisma.marketplace.findUnique({ where: { key: 'he' } });
    if (!mp) return res.status(400).json({ error: 'Hepsiburada yapılandırılmamış' });

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { marketplaceStates: { where: { marketplaceId: mp.id } } },
    });

    const results: Array<{ id: string; title: string | null; status: string; error?: string }> = [];
    let sentCount = 0;

    for (const product of products) {
      const errors: string[] = [];
      if (!product.categoryMatch) errors.push('Kategori');
      if (!product.brandMatch) errors.push('Marka');
      if (!product.variantMatch) errors.push('Varyant');
      if (!product.barcode) errors.push('Barkod');
      if (!product.salePrice || product.salePrice <= 0) errors.push('Fiyat');
      if (!product.images) errors.push('Görsel');
      if (product.stock <= 0) errors.push('Stok');

      if (errors.length > 0) {
        results.push({ id: product.id, title: product.title, status: 'BLOCKED', error: errors.join(', ') });
        continue;
      }

      const existing = product.marketplaceStates[0];
      if (existing) {
        await prisma.productMarketplaceState.update({
          where: { id: existing.id },
          data: { status: 'SENDING', price: product.salePrice, stock: product.stock, lastActionAt: new Date() },
        });
      } else {
        await prisma.productMarketplaceState.create({
          data: { productId: product.id, marketplaceId: mp.id, status: 'SENDING', price: product.salePrice, stock: product.stock, lastActionAt: new Date() },
        });
      }

      results.push({ id: product.id, title: product.title, status: 'SENDING' });
      sentCount++;
    }

    res.json({
      ok: true, sentCount, blockedCount: products.length - sentCount, results,
      message: `${sentCount} ürün Hepsiburada\'ya gönderiliyor`,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Gönderim başarısız' });
  }
});

// ==================== LOGLAR ====================

router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entity: 'marketplace', action: { startsWith: 'hepsiburada' } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: { actorUser: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count({ where: { entity: 'marketplace', action: { startsWith: 'hepsiburada' } } }),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
