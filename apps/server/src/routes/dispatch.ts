// ==================== GÖNDERİM MOTORU V5.0 ====================
// DG STOK V5.0 - Ready To Send & Marketplace Dispatch Engine
// ===========================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { queues } from '../queue/index.ts';

const router = Router();

// ==================== HAZIR ÜRÜNLER ====================

// GET /dispatch/ready - Gönderime hazır ürünleri listele
router.get('/ready', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query?.page ?? 1));
    const limit = Math.min(200, Math.max(10, Number(req.query?.limit ?? 50)));
    const skip = (page - 1) * limit;
    const search = String(req.query?.search ?? '').trim();
    const marketplaceId = req.query?.marketplaceId ? String(req.query.marketplaceId) : null;
    const status = String(req.query?.status ?? '').trim();

    const where: any = {};

    // 9 kriter kontrolü
    const readyWhere: any = {
      categoryMatch: true,
      brandMatch: true,
      variantMatch: true,
      barcode: { not: null },
      salePrice: { not: null, gt: 0 },
      images: { not: null },
      stock: { gt: 0 },
      status: { not: 'PASSIVE' },
    };

    if (status === 'ready') Object.assign(where, readyWhere);
    else if (status === 'incomplete') {
      where.OR = [
        { categoryMatch: false },
        { brandMatch: false },
        { variantMatch: false },
        { barcode: null },
        { salePrice: null },
        { images: null },
        { stock: { lte: 0 } },
        { status: 'PASSIVE' },
      ];
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          xmlSource: { select: { id: true, name: true, active: true } },
          variants: { select: { id: true, name: true, value: true } },
          marketplaceStates: marketplaceId ? {
            where: { marketplaceId },
            include: { marketplace: { select: { id: true, name: true, key: true } } },
          } : false,
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Her ürün için hazırlık skoru hesapla
    const enriched = items.map(p => {
      const checks = {
        categoryMatch: p.categoryMatch,
        brandMatch: p.brandMatch,
        variantMatch: p.variantMatch,
        barcode: !!p.barcode,
        salePrice: !!p.salePrice && p.salePrice > 0,
        images: !!p.images,
        stock: p.stock > 0,
        active: p.status !== 'PASSIVE',
        xmlActive: p.xmlSource?.active !== false,
      };
      const ready = Object.values(checks).every(Boolean);
      const score = Object.values(checks).filter(Boolean).length * 11.11; // 9 kriter * 11.11 = ~100
      const errors = Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k);

      return {
        ...p,
        readinessScore: Math.round(score),
        ready,
        errors,
        marketplaceState: (p as any).marketplaceStates?.[0] || null,
      };
    });

    res.json({
      items: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[dispatch] GET ready error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ready products' } });
  }
});

// ==================== İSTATİSTİKLER ====================

// GET /dispatch/stats - Gönderim istatistikleri
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [total, ready, incomplete, sent, failed, passive] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({
        where: { categoryMatch: true, brandMatch: true, variantMatch: true, barcode: { not: null }, salePrice: { not: null, gt: 0 }, images: { not: null }, stock: { gt: 0 }, status: { not: 'PASSIVE' } },
      }),
      prisma.product.count({
        where: { OR: [{ categoryMatch: false }, { brandMatch: false }, { variantMatch: false }, { barcode: null }, { salePrice: null }, { images: null }, { stock: { lte: 0 } }, { status: 'PASSIVE' }] },
      }),
      prisma.productMarketplaceState.count({ where: { status: 'SENT' } }),
      prisma.productMarketplaceState.count({ where: { status: 'ERROR' } }),
      prisma.product.count({ where: { status: 'PASSIVE' } }),
    ]);

    res.json({ total, ready, incomplete, sent, failed, passive });
  } catch (error) {
    console.error('[dispatch] GET stats error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dispatch stats' } });
  }
});

// ==================== GÖNDERİM ====================

// POST /dispatch/send - Ürünleri gönderime gönder
router.post('/send', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, marketplaceId } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds array is required' } });
    }
    if (!marketplaceId) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'marketplaceId is required' } });
    }

    // Ürünleri kontrol et
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { marketplaceStates: { where: { marketplaceId } } },
    });

    const results: Array<{ productId: string; status: string; error?: string }> = [];
    let sentCount = 0;

    for (const product of products) {
      // 9 kriter kontrolü
      const errors: string[] = [];
      if (!product.categoryMatch) errors.push('Kategori eşleşmemiş');
      if (!product.brandMatch) errors.push('Marka eşleşmemiş');
      if (!product.variantMatch) errors.push('Varyant tamamlanmamış');
      if (!product.barcode) errors.push('Barkod eksik');
      if (!product.salePrice || product.salePrice <= 0) errors.push('Satış fiyatı eksik');
      if (!product.images) errors.push('Görsel eksik');
      if (product.stock <= 0) errors.push('Stok yok');
      if (product.status === 'PASSIVE') errors.push('Ürün pasif');

      if (errors.length > 0) {
        results.push({ productId: product.id, status: 'BLOCKED', error: errors.join(', ') });
        continue;
      }

      // Marketplace state güncelle/oluştur
      const existingState = product.marketplaceStates[0];
      if (existingState) {
        await prisma.productMarketplaceState.update({
          where: { id: existingState.id },
          data: { status: 'SENDING', price: product.salePrice, stock: product.stock, lastActionAt: new Date() },
        });
      } else {
        await prisma.productMarketplaceState.create({
          data: { productId: product.id, marketplaceId, status: 'SENDING', price: product.salePrice, stock: product.stock, lastActionAt: new Date() },
        });
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'dispatch.send',
          entity: 'product',
          entityId: product.id,
          actorUserId: (req as AuthedRequest).actor?.userId ?? null,
          details: JSON.stringify({ marketplaceId, salePrice: product.salePrice, stock: product.stock }),
        },
      });

      results.push({ productId: product.id, status: 'SENDING' });
      sentCount++;
    }

    res.json({
      ok: true,
      sentCount,
      blockedCount: products.length - sentCount,
      results,
      message: `${sentCount} ürün gönderime gönderildi, ${products.length - sentCount} engellendi`,
    });
  } catch (error) {
    console.error('[dispatch] POST send error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to send products' } });
  }
});

// POST /dispatch/mark-success - Gönderim başarılı işaretle
router.post('/mark-success', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, marketplaceId } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds array is required' } });
    }
    let updatedCount = 0;

    for (const productId of productIds) {
      if (marketplaceId) {
        const state = await prisma.productMarketplaceState.findFirst({
          where: { productId, marketplaceId },
        });
        if (state) {
          await prisma.productMarketplaceState.update({
            where: { id: state.id },
            data: { status: 'SENT', lastActionAt: new Date() },
          });
          updatedCount++;
        }
      } else {
        await prisma.product.update({
          where: { id: productId },
          data: { status: 'SENT' },
        });
        updatedCount++;
      }
    }

    res.json({ ok: true, updatedCount, message: `${updatedCount} ürün başarılı olarak işaretlendi` });
  } catch (error) {
    console.error('[dispatch] POST mark-success error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to mark success' } });
  }
});

// GET /dispatch/history/:productId - Ürün gönderim geçmişi
router.get('/history/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const states = await prisma.productMarketplaceState.findMany({
      where: { productId },
      include: { marketplace: { select: { id: true, name: true, key: true } } },
      orderBy: { lastActionAt: 'desc' },
    });
    const logs = await prisma.auditLog.findMany({
      where: { entity: 'product', entityId: productId, action: { startsWith: 'dispatch' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ items: states, logs });
  } catch (error) {
    console.error('[dispatch] GET history error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch history' } });
  }
});

export default router;
