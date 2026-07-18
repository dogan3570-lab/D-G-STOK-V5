// ==================== XML ENGINE V5 API ROUTES ====================
// XML Veri Toplama Motoru endpoint'leri
// ===============================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';
import { xmlEngineV5 } from '../services/xml-engine/index.ts';
import { ImportLogger } from '../services/xml-engine/ImportLogger.ts';
import { FieldMapper } from '../services/xml-engine/FieldMapper.ts';

const router = Router();
const importLogger = new ImportLogger();
const fieldMapper = new FieldMapper();

// ==================== IMPORT İŞLEMLERİ ====================

// POST /api/xml-engine/import/:sourceId - XML/JSON/CSV import başlat
router.post('/import/:sourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { sourceId } = req.params;
    const result = await xmlEngineV5.importFromSource(sourceId, {
      sourceId,
      actorUserId: (req as any).actor?.userId ?? null,
    });
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/xml-engine/progress/:sourceId - Import durumu
router.get('/progress/:sourceId', requireAuth, async (req, res) => {
  try {
    const progress = xmlEngineV5.getProgress(req.params.sourceId);
    res.json({ ok: true, progress });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/xml-engine/progress - Tüm aktif import'lar
router.get('/progress', requireAuth, async (_req, res) => {
  try {
    const all = xmlEngineV5.getAllProgress();
    res.json({ ok: true, imports: all });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/xml-engine/cancel/:sourceId - Import iptal
router.post('/cancel/:sourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const cancelled = xmlEngineV5.cancelImport(req.params.sourceId);
    res.json({ ok: true, cancelled });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== MAPPING YÖNETİMİ ====================

// GET /api/xml-engine/mapping/:sourceId - Field mapping getir
router.get('/mapping/:sourceId', requireAuth, async (req, res) => {
  try {
    const mapping = await fieldMapper.getMapping(req.params.sourceId);
    res.json({ ok: true, mapping });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/xml-engine/mapping/:sourceId - Field mapping kaydet
router.post('/mapping/:sourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    await fieldMapper.saveMapping(req.params.sourceId, req.body.mapping || {});
    res.json({ ok: true, message: 'Mapping saved' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== İSTATİSTİKLER ====================

// GET /api/xml-engine/stats - Global import istatistikleri
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await importLogger.getGlobalStats();
    res.json({ ok: true, stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/xml-engine/runs/:sourceId - Kaynağa ait son import'lar
router.get('/runs/:sourceId', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const runs = await importLogger.getRecentRuns(req.params.sourceId, limit);
    res.json({ ok: true, runs });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== XML TEST ====================

// POST /api/xml-engine/test - XML parse test (kaydetmeden)
router.post('/test', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { content, sourceType } = req.body;
    if (!content) {
      return res.status(400).json({ ok: false, error: 'Content required' });
    }

    const { XmlEngineV5 } = await import('../services/xml-engine/XmlEngineV5.ts');
    const engine = new XmlEngineV5();
    const adapter = engine['getAdapter'](sourceType || 'xml');
    const result = await adapter.parseAll(content);

    res.json({
      ok: true,
      total: result.products.length,
      errors: result.errors,
      sample: result.products.slice(0, 3),
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export { router as xmlEngineRouter };
