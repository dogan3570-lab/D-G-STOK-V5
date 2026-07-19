// ==================== TRENDYOL API PRODUCTION ENGINE V5 ====================
// DG STOK V5.0 - Trendyol Marketplace Entegrasyonu
// API ayarları, test, ürün gönderimi, stok/fiyat güncelleme
// =======================================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

// ==================== DURUM ====================

// GET /marketplace/trendyol/status - Trendyol bağlantı durumu
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const mp = await prisma.marketplace.findUnique({ where: { key: 'tt' } });
    if (!mp) return res.json({ connected: false, status: 'not_configured' });

    const sentCount = await prisma.productMarketplaceState.count({
      where: { marketplaceId: mp.id, status: 'SENT' },
    });
    const errorCount = await prisma.productMarketplaceState.count({
      where: { marketplaceId: mp.id, status: 'ERROR' },
    });
    const pendingCount = await prisma.productMarketplaceState.count({
      where: { marketplaceId: mp.id, status: { in: ['READY', 'SENDING'] } },
    });

    res.json({
      connected: mp.apiStatus === 'ok' || mp.apiStatus === 'connected',
      status: mp.apiStatus,
      apiKey: mp.apiKey ? '***' + mp.apiKey.slice(-4) : null,
      lastTestAt: mp.updatedAt,
      lastError: mp.apiStatus === 'error' ? 'Son bağlantı hatası' : null,
      stats: { sentCount, errorCount, pendingCount },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Trendyol status' });
  }
});

// ==================== TEST ====================

// POST /marketplace/trendyol/test - API bağlantı testi
router.post('/test', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const mp = await prisma.marketplace.findUnique({ where: { key: 'tt' } });
    if (!mp || !mp.apiKey || !mp.apiSecret) {
      return res.json({ ok: false, message: 'Trendyol API bilgileri eksik' });
    }

    try {
      // Test isteği: Trendyol kategorilerini getir
      const testUrl = `${mp.apiUrl || 'https://api.trendyol.com/sapigw'}/brands`;
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
      else if (response.status >= 500) apiStatus = 'server_error';

      await prisma.marketplace.update({
        where: { id: mp.id },
        data: { apiStatus, lastError: response.ok ? null : `HTTP ${response.status}: ${response.statusText}` },
      });

      const result = await response.json();
      const brandCount = result?.brands?.length || result?.result?.length || 0;

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'trendyol.test',
          entity: 'marketplace',
          entityId: mp.id,
          actorUserId: (req as AuthedRequest).actor?.userId ?? null,
          details: JSON.stringify({ httpStatus: response.status, brandCount, timestamp: new Date().toISOString() }),
        },
      });

      res.json({
        ok: response.ok,
        status: apiStatus,
        httpStatus: response.status,
        message: response.ok
          ? `✅ Bağlantı başarılı! ${brandCount} marka bulundu`
          : `❌ Bağlantı hatası: HTTP ${response.status} - ${response.statusText}`,
        brandCount,
      });
    } catch (fetchError: any) {
      const isTimeout = fetchError.name === 'AbortError';
      await prisma.marketplace.update({
        where: { id: mp.id },
        data: { apiStatus: isTimeout ? 'timeout' : 'error', lastError: isTimeout ? 'Timeout (15sn)' : fetchError.message },
      });
      res.json({ ok: false, status: isTimeout ? 'timeout' : 'error', message: isTimeout ? '⏱ Bağlantı zaman aşımı' : `❌ ${fetchError.message}` });
    }
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Test başarısız' });
  }
});

// ==================== AYARLAR ====================

// PUT /marketplace/trendyol/settings - API ayarlarını güncelle
router.put('/settings', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { apiKey, apiSecret, supplierId } = req.body;

    const data: Record<string, any> = {};
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (apiSecret !== undefined) data.apiSecret = apiSecret;
    if (supplierId !== undefined) {
      data.merchantId = supplierId;
      data.storeId = supplierId;
    }

    // Ayarları güncelle
    const existing = await prisma.marketplace.findUnique({ where: { key: 'tt' } });
    if (existing && (apiKey || apiSecret)) {
      data.apiStatus = 'unknown'; // Yeni bilgilerle test edilmemiş
    }

    const mp = existing
      ? await prisma.marketplace.update({ where: { key: 'tt' }, data })
      : await prisma.marketplace.create({
          data: {
            key: 'tt',
            name: 'Trendyol',
            apiStatus: 'unknown',
            apiUrl: 'https://api.trendyol.com/sapigw',
            ...data,
          },
        });

    // .env dosyasına kaydetme (opsiyonel)
    // Gerçek production'da env vars kullanılır

    await prisma.auditLog.create({
      data: {
        action: 'trendyol.settings.update',
        entity: 'marketplace',
        entityId: mp.id,
        actorUserId: (req as AuthedRequest).actor?.userId ?? null,
        details: JSON.stringify({ hasApiKey: !!apiKey, hasApiSecret: !!apiSecret, supplierId }),
      },
    });

    res.json({
      ok: true,
      message: '✅ Trendyol ayarları güncellendi',
      apiKeyMasked: mp.apiKey ? '***' + mp.apiKey.slice(-4) : null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Ayarlar güncellenemedi' });
  }
});

// ==================== GÖNDERİM ====================

// POST /marketplace/trendyol/send - Ürünleri Trendyol'a gönder
router.post('/send', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds required' });
    }

    const mp = await prisma.marketplace.findUnique({ where: { key: 'tt' } });
    if (!mp) return res.status(400).json({ error: 'Trendyol yapılandırılmamış' });

    // 9 kriter kontrolü
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
      if (product.status === 'PASSIVE') errors.push('Pasif');

      if (errors.length > 0) {
        results.push({ id: product.id, title: product.title, status: 'BLOCKED', error: errors.join(', ') });
        continue;
      }

      // Marketplace state güncelle
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
      ok: true,
      sentCount,
      blockedCount: products.length - sentCount,
      results,
      message: `${sentCount} ürün Trendyol'a gönderiliyor, ${products.length - sentCount} engellendi`,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Gönderim başarısız' });
  }
});

// ==================== LOGLAR ====================

// GET /marketplace/trendyol/logs - Trendyol logları
router.get('/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entity: 'marketplace', entityId: { not: null }, action: { startsWith: 'trendyol' } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actorUser: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count({ where: { entity: 'marketplace', entityId: { not: null }, action: { startsWith: 'trendyol' } } }),
    ]);

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
