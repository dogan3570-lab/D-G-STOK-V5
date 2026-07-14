// ==================== AI CONTENT COMPLIANCE ENGINE ROUTES ====================
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';
import {
  checkProductContent,
  batchCheckProducts,
  getContentStats,
  logApiError,
  seedDefaultForbiddenWords,
  seedMarketplaceProfiles,
} from '../services/contentEngine/index.ts';

const router = Router();

// ==================== STATS ====================
router.get('/stats', requireAuth, async (_req, res) => {
  try {
    const stats = await getContentStats();
    return res.json({ ok: true, stats });
  } catch (error) {
    console.error('[content] GET /stats error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'İstatistik alınamadı' } });
  }
});

// ==================== CHECK PRODUCT ====================
router.post('/check/:productId', requireAuth, async (req, res) => {
  try {
    const marketplaceKey = req.body?.marketplaceKey || req.query?.marketplaceKey || 'trendyol';
    const report = await checkProductContent(req.params.productId, String(marketplaceKey));
    return res.json({ ok: true, report });
  } catch (error) {
    console.error('[content] POST /check error:', error);
    return res.status(500).json({ ok: false, error: { code: 'CHECK_ERROR', message: 'İçerik kontrolü başarısız' } });
  }
});

// ==================== BATCH CHECK ====================
router.post('/check-batch', requireAuth, async (req, res) => {
  try {
    const { ids, marketplaceKey } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'ids array is required' } });
    }
    const result = await batchCheckProducts(ids, marketplaceKey || 'trendyol');
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[content] POST /check-batch error:', error);
    return res.status(500).json({ ok: false, error: { code: 'CHECK_ERROR', message: 'Toplu kontrol başarısız' } });
  }
});

// ==================== ISSUES ====================
router.get('/issues', requireAuth, async (req, res) => {
  try {
    const page = parseInt(String(req.query?.page || '1'));
    const limit = parseInt(String(req.query?.limit || '50'));
    const status = req.query?.status ? String(req.query.status) : undefined;

    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.contentAnalysisResult.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contentAnalysisResult.count({ where }),
    ]);

    return res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[content] GET /issues error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Sorunlar alınamadı' } });
  }
});

// ==================== FORBIDDEN WORDS CRUD ====================
router.get('/forbidden-words', requireAuth, async (req, res) => {
  try {
    const search = req.query?.search ? String(req.query.search) : '';
    const category = req.query?.category ? String(req.query.category) : '';
    const where: any = {};
    if (search) where.word = { contains: search };
    if (category) where.category = category;

    const items = await prisma.forbiddenWord.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ ok: true, items });
  } catch (error) {
    console.error('[content] GET /forbidden-words error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Yasak kelimeler alınamadı' } });
  }
});

router.post('/forbidden-words', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { word, category, riskLevel, marketplaces, autoFix } = req.body;
    if (!word) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'word is required' } });
    }
    const item = await prisma.forbiddenWord.create({
      data: { word, category: category || 'OTHER', riskLevel: riskLevel || 'HIGH', marketplaces, autoFix },
    });
    return res.status(201).json({ ok: true, item });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Bu kelime zaten kayıtlı' } });
    }
    console.error('[content] POST /forbidden-words error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Kelime eklenemedi' } });
  }
});

router.put('/forbidden-words/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { word, category, riskLevel, marketplaces, autoFix, isActive } = req.body;
    const data: any = {};
    if (word !== undefined) data.word = word;
    if (category !== undefined) data.category = category;
    if (riskLevel !== undefined) data.riskLevel = riskLevel;
    if (marketplaces !== undefined) data.marketplaces = marketplaces;
    if (autoFix !== undefined) data.autoFix = autoFix;
    if (isActive !== undefined) data.isActive = isActive;

    const item = await prisma.forbiddenWord.update({ where: { id: req.params.id }, data });
    return res.json({ ok: true, item });
  } catch (error) {
    console.error('[content] PUT /forbidden-words error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Kelime güncellenemedi' } });
  }
});

router.delete('/forbidden-words/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    await prisma.forbiddenWord.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[content] DELETE /forbidden-words error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Kelime silinemedi' } });
  }
});

// ==================== FORBIDDEN WORD IMPORT/EXPORT ====================
router.post('/forbidden-words/import', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'words array is required' } });
    }
    let imported = 0;
    for (const w of words) {
      try {
        await prisma.forbiddenWord.upsert({
          where: { word: w.word },
          create: { word: w.word, category: w.category || 'OTHER', riskLevel: w.riskLevel || 'HIGH', autoFix: w.autoFix },
          update: { isActive: true },
        });
        imported++;
      } catch { /* skip duplicates */ }
    }
    return res.json({ ok: true, imported });
  } catch (error) {
    console.error('[content] POST /forbidden-words/import error:', error);
    return res.status(500).json({ ok: false, error: { code: 'IMPORT_ERROR', message: 'İçe aktarma başarısız' } });
  }
});

router.get('/forbidden-words/export', requireAuth, async (_req, res) => {
  try {
    const items = await prisma.forbiddenWord.findMany({ where: { isActive: true } });
    return res.json({ ok: true, items });
  } catch (error) {
    console.error('[content] GET /forbidden-words/export error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Dışa aktarma başarısız' } });
  }
});

// ==================== MARKETPLACE PROFILES ====================
router.get('/marketplace-profiles', requireAuth, async (_req, res) => {
  try {
    const items = await prisma.marketplaceContentProfile.findMany();
    return res.json({ ok: true, items });
  } catch (error) {
    console.error('[content] GET /marketplace-profiles error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Profiller alınamadı' } });
  }
});

router.put('/marketplace-profiles/:key', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const data: any = {};
    const fields = ['maxTitleLength', 'minTitleLength', 'maxUppercaseRatio', 'emojiPolicy',
      'allowHtml', 'allowedHtmlTags', 'minImageWidth', 'minImageHeight',
      'maxImageWidth', 'maxImageHeight', 'whiteBackground', 'barcodeRequired', 'barcodeFormat'];
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }
    const item = await prisma.marketplaceContentProfile.update({ where: { marketplaceKey: req.params.key }, data });
    return res.json({ ok: true, item });
  } catch (error) {
    console.error('[content] PUT /marketplace-profiles error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'Profil güncellenemedi' } });
  }
});

// ==================== API ERRORS ====================
router.get('/api-errors', requireAuth, async (req, res) => {
  try {
    const page = parseInt(String(req.query?.page || '1'));
    const limit = parseInt(String(req.query?.limit || '50'));
    const [items, total] = await Promise.all([
      prisma.apiErrorLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.apiErrorLog.count(),
    ]);
    return res.json({ ok: true, items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[content] GET /api-errors error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'API hataları alınamadı' } });
  }
});

router.post('/api-errors', requireAuth, async (req, res) => {
  try {
    const { productId, marketplaceKey, errorCode, errorMessage, rejectedField } = req.body;
    if (!productId || !marketplaceKey || !errorCode) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'productId, marketplaceKey, errorCode required' } });
    }
    await logApiError({ productId, marketplaceKey, errorCode, errorMessage, rejectedField });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('[content] POST /api-errors error:', error);
    return res.status(500).json({ ok: false, error: { code: 'DB_ERROR', message: 'API hatası kaydedilemedi' } });
  }
});

// ==================== SEED ====================
router.post('/seed', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const wordsCount = await seedDefaultForbiddenWords();
    const profilesCount = await seedMarketplaceProfiles();
    return res.json({ ok: true, seeded: { forbiddenWords: wordsCount, profiles: profilesCount } });
  } catch (error) {
    console.error('[content] POST /seed error:', error);
    return res.status(500).json({ ok: false, error: { code: 'SEED_ERROR', message: 'Seed başarısız' } });
  }
});

export default router;
