// ==================== GÖNDERİME HAZIR MERKEZİ ROUTES ====================
// DG STOK V5.0 - ReadyToSend API
// =======================================================================

import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { ReadyToSendEngine } from '../services/readyToSend/ReadyToSendEngine.ts';
import { prisma } from '../db/prisma.ts';

const router = Router();

// GET /api/ready-to-send/check/:productId - Tek ürün kontrolü
router.get('/check/:productId', requireAuth, async (req, res) => {
  try {
    const result = await ReadyToSendEngine.checkProduct(req.params.productId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/ready-to-send/list - Hazır ürün listesi
router.get('/list', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const status = req.query.status ? String(req.query.status) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await ReadyToSendEngine.listReady(page, limit, { status, search });
    res.json({ ok: true, items: result.items, total: result.total, page, limit });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/ready-to-send/send - Pazaryerine gönder
router.post('/send', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { productIds, marketplaceId } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'productIds gerekli' });
    }
    if (!marketplaceId) {
      return res.status(400).json({ ok: false, error: 'marketplaceId gerekli' });
    }

    // Her ürün için gönderim state'i oluştur
    let sent = 0;
    for (const productId of productIds) {
      const check = await ReadyToSendEngine.checkProduct(productId);
      if (!check.ready) continue;

      await prisma.productMarketplaceState.upsert({
        where: { productId_marketplaceId: { productId, marketplaceId } },
        update: { status: 'SENDING', lastActionAt: new Date() },
        create: { productId, marketplaceId, status: 'SENDING', lastActionAt: new Date() },
      });
      sent++;
    }

    res.json({ ok: true, sent, total: productIds.length, message: `${sent} ürün gönderime alındı` });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
