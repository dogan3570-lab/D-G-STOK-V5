// ==================== VARYANT MOTORU V4.0 API ROUTE'LARI ====================
// DG STOK V5.0 - Universal XML Profile Engine + Smart Variant Engine
// =========================================================================
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import {
  runV4Pipeline,
  getV4Stats,
  getV4Problems,
  getFamilies,
  getV4Report,
  autoMatchProducts,
  manualMatchProducts,
  reanalyzeProducts,
} from '../services/variantEngineV4/index.ts';

const router = Router();

// ==================== 1. STATS ====================
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const stats = await getV4Stats(xmlSourceId);
    return res.json({ ok: true, stats });
  } catch (error) {
    console.error('[variantsV4] GET /stats error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'DB_ERROR', message: 'İstatistik alınamadı' },
    });
  }
});

// ==================== 2. REPORT ====================
router.get('/report', requireAuth, async (req, res) => {
  try {
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const report = await getV4Report(xmlSourceId);
    return res.json({ ok: true, report });
  } catch (error) {
    console.error('[variantsV4] GET /report error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'DB_ERROR', message: 'Rapor alınamadı' },
    });
  }
});

// ==================== 3. SCAN ====================
router.post('/scan', requireAuth, async (req, res) => {
  try {
    const { xmlSourceId, marketplaceKey } = req.body;
    const result = await runV4Pipeline(xmlSourceId || undefined, marketplaceKey || 'trendyol');
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV4] POST /scan error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'SCAN_ERROR', message: 'Varyant taraması başarısız' },
    });
  }
});

router.post('/scan/:xmlSourceId', requireAuth, async (req, res) => {
  try {
    const { xmlSourceId } = req.params;
    const { marketplaceKey } = req.body;
    const result = await runV4Pipeline(xmlSourceId, marketplaceKey || 'trendyol');
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV4] POST /scan/:xmlSourceId error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'SCAN_ERROR', message: 'XML kaynağı taraması başarısız' },
    });
  }
});

// ==================== 4. PROBLEMS ====================
router.get('/problems', requireAuth, async (req, res) => {
  try {
    const status = req.query?.status ? String(req.query.status) : undefined;
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const search = req.query?.search ? String(req.query.search) : undefined;
    const page = parseInt(String(req.query?.page || '1'));
    const limit = parseInt(String(req.query?.limit || '50'));

    const result = await getV4Problems({ status, xmlSourceId, search, page, limit });
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV4] GET /problems error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'DB_ERROR', message: 'Sorunlu ürünler alınamadı' },
    });
  }
});

// ==================== 5. AUTO MATCH ====================
router.post('/auto-match', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        ok: false, error: { code: 'VALIDATION_ERROR', message: 'ids array is required' },
      });
    }
    const result = await autoMatchProducts(ids);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV4] POST /auto-match error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'MATCH_ERROR', message: 'Otomatik eşleştirme başarısız' },
    });
  }
});

// ==================== 6. MANUAL MATCH ====================
router.post('/manual-match', requireAuth, async (req, res) => {
  try {
    const { groupId, ids } = req.body;
    if (!groupId || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        ok: false, error: { code: 'VALIDATION_ERROR', message: 'groupId and ids array are required' },
      });
    }
    const result = await manualMatchProducts(groupId, ids);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV4] POST /manual-match error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'MATCH_ERROR', message: 'Manuel eşleştirme başarısız' },
    });
  }
});

// ==================== 7. REANALYZE ====================
router.post('/reanalyze', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        ok: false, error: { code: 'VALIDATION_ERROR', message: 'ids array is required' },
      });
    }
    const result = await reanalyzeProducts(ids);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[variantsV4] POST /reanalyze error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'REANALYZE_ERROR', message: 'Tekrar analiz başarısız' },
    });
  }
});

// ==================== 8. FAMILIES ====================
router.get('/families', requireAuth, async (req, res) => {
  try {
    const xmlSourceId = req.query?.xmlSourceId ? String(req.query.xmlSourceId) : undefined;
    const families = await getFamilies(xmlSourceId);
    return res.json({ ok: true, items: families });
  } catch (error) {
    console.error('[variantsV4] GET /families error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'DB_ERROR', message: 'Aileler alınamadı' },
    });
  }
});

// ==================== 9. PROFILE ====================
router.get('/profile/:xmlSourceId', requireAuth, async (req, res) => {
  try {
    const { xmlSourceId } = req.params;
    const profile = await prisma.xmlProfile.findUnique({ where: { xmlSourceId } });
    if (!profile) {
      return res.status(404).json({
        ok: false, error: { code: 'NOT_FOUND', message: 'XML profili bulunamadı' },
      });
    }
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error('[variantsV4] GET /profile error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'DB_ERROR', message: 'Profil alınamadı' },
    });
  }
});

// ==================== 10. THRESHOLDS (V4 ile uyumlu) ====================
router.get('/thresholds', requireAuth, async (_req, res) => {
  try {
    const items = await prisma.variantThreshold.findMany();
    const thresholdMap: Record<string, number> = {};
    for (const t of items) thresholdMap[t.key] = t.value;
    // V4 varsayılanları
    if (!thresholdMap['auto_accept']) thresholdMap['auto_accept'] = 95;
    if (!thresholdMap['auto_create']) thresholdMap['auto_create'] = 90;
    if (!thresholdMap['re_analyze']) thresholdMap['re_analyze'] = 80;
    if (!thresholdMap['auto_suggest']) thresholdMap['auto_suggest'] = 70;
    return res.json({ ok: true, items: thresholdMap });
  } catch (error) {
    console.error('[variantsV4] GET /thresholds error:', error);
    return res.status(500).json({
      ok: false, error: { code: 'DB_ERROR', message: 'Eşikler alınamadı' },
    });
  }
});

export default router;
