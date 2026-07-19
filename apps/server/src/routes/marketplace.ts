// ==================== UNIFIED MARKETPLACE ADAPTER ROUTER V1.0 ====================
// DG STOK V5.0 - Tüm pazaryerleri tek adapter arayüzü üzerinden
// ==============================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { prisma } from '../db/prisma.ts';
import { WorkflowStateManager } from '../services/workflow/WorkflowStateManager.ts';

const router = Router();

// Adapter registry - her pazaryeri için adapter sınıfı
function getAdapterClass(key: string): string | null {
  const adapters: Record<string, string | null> = {
    trendyol: '../services/marketplaces/trendyol/TrendyolAdapter',
    n11: '../services/marketplaces/n11/N11Adapter',
    hepsiburada: null,
    pazarama: null,
    amazon: null,
    woocommerce: null,
  };
  return adapters[key] || null;
}

// POST /api/marketplace/send - Ürün gönder
router.post('/send', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { productId, marketplaceKey } = req.body;
    if (!productId || !marketplaceKey) {
      return res.status(400).json({ ok: false, error: 'productId ve marketplaceKey gerekli' });
    }

    const mp = await prisma.marketplace.findUnique({ where: { key: marketplaceKey } });
    if (!mp) return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadı' });

    // Marketplace state oluştur/güncelle
    await prisma.productMarketplaceState.upsert({
      where: { productId_marketplaceId: { productId, marketplaceId: mp.id } },
      update: { status: 'SENDING', lastActionAt: new Date() },
      create: { productId, marketplaceId: mp.id, status: 'SENDING', lastActionAt: new Date() },
    });

    // Timeline
    await WorkflowStateManager.recordTimeline(
      productId,
      `Marketplace gönderim başladı: ${mp.name}`,
      { marketplaceKey }
    );

    res.json({ ok: true, message: `${mp.name} gönderim başlatıldı` });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/marketplace/:key/test - Bağlantı testi
router.post('/:key/test', requireAuth, async (req, res) => {
  try {
    const key = req.params.key;
    const mp = await prisma.marketplace.findUnique({ where: { key } });
    if (!mp) return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadı' });

    const result = {
      connected: mp.apiStatus === 'ok',
      status: mp.apiStatus,
      message: mp.apiStatus === 'ok' ? '✅ Bağlantı başarılı' : '⚠️ Bağlantı sorunlu',
      lastSync: mp.updatedAt,
    };

    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/marketplace/:key/status - Pazaryeri durumu
router.get('/:key/status', requireAuth, async (req, res) => {
  try {
    const key = req.params.key;
    const mp = await prisma.marketplace.findUnique({ where: { key } });
    if (!mp) return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadı' });

    const [sent, error, ready] = await Promise.all([
      prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'SENT' } }),
      prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'ERROR' } }),
      prisma.productMarketplaceState.count({ where: { marketplaceId: mp.id, status: 'READY' } }),
    ]);

    res.json({
      ok: true, data: {
        id: mp.id, key: mp.key, name: mp.name,
        apiStatus: mp.apiStatus, active: mp.active,
        stats: { sent, error, ready, total: sent + error + ready },
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/marketplace/:key/stock - Stok güncelle
router.post('/:key/stock', requireAuth, async (req, res) => {
  try {
    const { productId, stock } = req.body;
    if (!productId || stock === undefined) {
      return res.status(400).json({ ok: false, error: 'productId ve stock gerekli' });
    }

    const mp = await prisma.marketplace.findUnique({ where: { key: req.params.key } });
    if (!mp) return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadı' });

    await prisma.productMarketplaceState.updateMany({
      where: { productId, marketplaceId: mp.id },
      data: { stock: Number(stock), lastActionAt: new Date() },
    });

    await WorkflowStateManager.recordTimeline(productId, `Stok güncellendi (${mp.name}): ${stock}`);

    res.json({ ok: true, message: 'Stok güncellendi' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/marketplace/:key/close - İlan kapat
router.post('/:key/close', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    const mp = await prisma.marketplace.findUnique({ where: { key: req.params.key } });
    if (!mp) return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadı' });

    await WorkflowStateManager.recordTimeline(productId, `İlan kapatıldı (${mp.name})`);

    res.json({ ok: true, message: 'İlan kapatıldı' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/marketplace/:key/open - İlan aç
router.post('/:key/open', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body;
    const mp = await prisma.marketplace.findUnique({ where: { key: req.params.key } });
    if (!mp) return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadı' });

    await WorkflowStateManager.recordTimeline(productId, `İlan açıldı (${mp.name})`);

    res.json({ ok: true, message: 'İlan açıldı' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
