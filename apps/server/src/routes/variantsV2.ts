// ==================== VARYANT MOTORU V2.0 API ROUTE'LARI ====================
// DG STOK V5.0 - Akıllı Doğrulama ve İstisna Yönetimi
// =============================================================================
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import {
  analyzeAllProducts,
  getAnalysisStats,
  getVariantScreenProducts,
  autoMatchProducts,
  manualMatchProducts,
  reanalyzeProducts,
} from '../services/variantEngineV2.ts';

const router = Router();

// ==================== 1. STATS ====================
// GET /api/variants/v2/stats → KPI istatistikleri
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const stats = await getAnalysisStats(xmlSourceId);
    return res.json({ ok: true, stats });
  } catch (error) {
    console.error('[variantsV2] GET /stats error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'İstatistik alınamadı' },
    });
  }
});

// ==================== 2. SCAN ALL ====================
// POST /api/variants/v2/scan → analyzeAllProducts()
router.post('/scan', requireAuth, async (req, res) => {
  try {
    const { xmlSourceId, marketplaceKey } = req.body;
    const result = await analyzeAllProducts(
      xmlSourceId || undefined,
      marketplaceKey || 'trendyol'
    );
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] POST /scan error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'SCAN_ERROR', message: 'Varyant taraması başarısız' },
    });
  }
});

// ==================== 3. SCAN BY XML SOURCE ====================
// POST /api/variants/v2/scan/:xmlSourceId → XML kaynağına göre analiz
router.post('/scan/:xmlSourceId', requireAuth, async (req, res) => {
  try {
    const { xmlSourceId } = req.params;
    const { marketplaceKey } = req.body;
    const result = await analyzeAllProducts(
      xmlSourceId,
      marketplaceKey || 'trendyol'
    );
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] POST /scan/:xmlSourceId error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'SCAN_ERROR', message: 'XML kaynağı varyant taraması başarısız' },
    });
  }
});

// ==================== 3.5 VARYANT EKRANI PROBLEMLERİ (Ürün Hazırlama > Varyant için) ====================
// GET /api/variants/v2/problems → Varyant problem listesi
// VariantMatchTab.tsx tarafından kullanılır
router.get('/problems', requireAuth, async (req, res) => {
  try {
    const status = req.query?.status ? String(req.query.status) : undefined;
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const search = req.query?.search ? String(req.query.search) : undefined;
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));

    const result = await getVariantScreenProducts({
      status: status || 'all',
      xmlSourceId,
      search,
      page,
      limit,
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] GET /problems error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Varyant problem verileri alınamadı' },
    });
  }
});

// ==================== 4. VARYANT EKRANI ÜRÜNLERİ ====================
// GET /api/variants/v2/screen → Varyant ekranı (istisna yönetimi) için ürünler
router.get('/screen', requireAuth, async (req, res) => {
  try {
    const status = req.query?.status ? String(req.query.status) : undefined;
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const search = req.query?.search ? String(req.query.search) : undefined;
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));

    const result = await getVariantScreenProducts({
      status: status || 'all',
      xmlSourceId,
      search,
      page,
      limit,
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] GET /screen error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Varyant ekranı verileri alınamadı' },
    });
  }
});

// ==================== 5. OTOMATİK EŞLEŞTİR ====================
// POST /api/variants/v2/auto-match → Güven skoru yeterli ürünleri otomatik eşleştir
router.post('/auto-match', requireAuth, async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'productIds array gerekli' },
      });
    }

    const result = await autoMatchProducts(productIds);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] POST /auto-match error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'MATCH_ERROR', message: 'Otomatik eşleştirme başarısız' },
    });
  }
});

// ==================== 6. OTOMATİK EŞLEŞTİRMEYİ ONAYLA ====================
// POST /api/variants/v2/confirm-auto-match → Önizleme onaylandıktan sonra kaydet
router.post('/confirm-auto-match', requireAuth, async (req, res) => {
  try {
    const { matches } = req.body;
    // matches: Array<{ productId: string; parentSku: string; groupId: string }>
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'matches array gerekli' },
      });
    }

    let totalUpdated = 0;
    for (const match of matches) {
      const { productId, parentSku, groupId } = match;
      if (!productId || !parentSku) continue;

      await prisma.variantAnalysis.upsert({
        // NOT: "va_" prefix'li ID formatı kullanılır (servis katmanıyla tutarlı)
        where: { id: `va_${productId}` },
        create: {
          id: `va_${productId}`,
          productId,
          confidence: 100,
          source: 'AI_MATCH',
          status: 'AUTO_ACCEPTED',
          reason: null,
          parentSku,
          groupId: groupId || null,
          xmlHasParent: false,
          checkResults: JSON.stringify({ autoMatched: true }),
        },
        update: {
          confidence: 100,
          source: 'AI_MATCH',
          status: 'AUTO_ACCEPTED',
          reason: null,
          parentSku,
          groupId: groupId || null,
        },
      });
      totalUpdated++;
    }

    return res.json({ ok: true, totalUpdated });
  } catch (error) {
    console.error('[variantsV2] POST /confirm-auto-match error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Onaylama başarısız' },
    });
  }
});

// ==================== 7. MANUEL EŞLEŞTİR ====================
// POST /api/variants/v2/manual-match → Kullanıcı manuel eşleştirme yapar
router.post('/manual-match', requireAuth, async (req, res) => {
  try {
    const { matches } = req.body;
    // matches: Array<{ productIds: string[]; parentSku: string; groupId?: string }>
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'matches array gerekli' },
      });
    }

    const result = await manualMatchProducts(matches);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] POST /manual-match error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Manuel eşleştirme başarısız' },
    });
  }
});

// ==================== 8. YENİDEN ANALİZ ET ====================
// POST /api/variants/v2/reanalyze → Seçilen ürünleri yeniden analiz et
router.post('/reanalyze', requireAuth, async (req, res) => {
  try {
    const { productIds, marketplaceKey } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'productIds array gerekli' },
      });
    }

    const result = await reanalyzeProducts(productIds, marketplaceKey || 'trendyol');
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV2] POST /reanalyze error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'SCAN_ERROR', message: 'Yeniden analiz başarısız' },
    });
  }
});

// ==================== 9. SEÇİLENLERİ ONAYLA ====================
// POST /api/variants/v2/approve-selected → Seçilen ürünleri onayla (AUTO_ACCEPTED yap)
router.post('/approve-selected', requireAuth, async (req, res) => {
  try {
    const { productIds, groupId, parentSku } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'productIds array gerekli' },
      });
    }

    const gId = groupId || `DG_GRP_${Date.now()}`;
    let updated = 0;

    for (const productId of productIds) {
      await prisma.variantAnalysis.upsert({
        // NOT: "va_" prefix'li ID formatı (servis katmanıyla tutarlı)
        where: { id: `va_${productId}` },
        create: {
          id: `va_${productId}`,
          productId,
          confidence: 100,
          source: 'MANUAL',
          status: 'AUTO_ACCEPTED',
          reason: null,
          parentSku: parentSku || null,
          groupId: gId,
          xmlHasParent: false,
          checkResults: JSON.stringify({ approved: true }),
        },
        update: {
          status: 'AUTO_ACCEPTED',
          reason: null,
          parentSku: parentSku || null,
          groupId: gId,
        },
      });
      updated++;
    }

    return res.json({ ok: true, updated, groupId: gId });
  } catch (error) {
    console.error('[variantsV2] POST /approve-selected error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Onaylama başarısız' },
    });
  }
});

// ==================== 10. EŞİK DEĞERLERİ ====================
// GET /api/variants/v2/thresholds
router.get('/thresholds', requireAuth, async (req, res) => {
  try {
    const items = await prisma.variantThreshold.findMany({
      orderBy: { key: 'asc' },
    });
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.key] = item.value;
    }
    // Varsayılan değerler
    const defaults: Record<string, number> = {
      auto_accept: 95,
      auto_suggest: 80,
      manual: 0,
    };
    return res.json({ ok: true, items: { ...defaults, ...map } });
  } catch (error) {
    console.error('[variantsV2] GET /thresholds error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Eşik değerleri alınamadı' },
    });
  }
});

// ==================== 11. EŞİK DEĞERLERİNİ GÜNCELLE ====================
// PUT /api/variants/v2/thresholds
router.put('/thresholds', requireAuth, async (req, res) => {
  try {
    const thresholds = req.body;
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'thresholds body olarak gönderilmelidir' },
      });
    }

    const allowedKeys = ['auto_accept', 'auto_suggest', 'manual'];
    const updated: Record<string, number> = {};

    for (const key of allowedKeys) {
      if (thresholds[key] !== undefined) {
        const value = Number(thresholds[key]);
        if (isNaN(value) || value < 0 || value > 100) {
          return res.status(400).json({
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `${key} değeri 0-100 arasında olmalıdır`,
            },
          });
        }
        await prisma.variantThreshold.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
        updated[key] = value;
      }
    }

    // Güncel tüm değerleri dön
    const items = await prisma.variantThreshold.findMany({
      orderBy: { key: 'asc' },
    });
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.key] = item.value;
    }
    const defaults: Record<string, number> = {
      auto_accept: 95,
      auto_suggest: 80,
      manual: 0,
    };

    return res.json({ ok: true, items: { ...defaults, ...map }, updated });
  } catch (error) {
    console.error('[variantsV2] PUT /thresholds error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Eşik değerleri güncellenemedi' },
    });
  }
});

export default router;
