// ==================== AI IMAGE QUALITY CENTER REST API V1 ====================
// DG STOK V5.0 - AI Görsel Kalite Kontrol API'leri
// ============================================================================

import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import { AIImageEngine } from '../services/aiImage/AIImageEngine.ts';

export const aiImageRouter = Router();

const aiImageEngine = new AIImageEngine();

// ==================== POST /ai-image/analyze ====================
// Tek ürün görselini analiz et
aiImageRouter.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { productId, imageUrl, category, marketplaceKey } = req.body;

    if (!productId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'productId zorunludur' },
      });
    }

    const result = await aiImageEngine.analyzeProductImage(productId, imageUrl || '', {
      category,
      marketplaceKey,
    });

    return res.json({
      ok: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[aiImage] Analyze error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'ANALYSIS_FAILED', message: error.message || 'Analiz başarısız' },
    });
  }
});

// ==================== POST /ai-image/bulk-analyze ====================
// Toplu görsel analizi
aiImageRouter.post('/bulk-analyze', requireAuth, async (req, res) => {
  try {
    const { productIds, count, category, marketplaceKey } = req.body;

    let result;

    if (count) {
      // Belirli sayıda ürün analizi (100, 500, 1000, 5000)
      result = await aiImageEngine.analyzeByCount(Number(count), { category, marketplaceKey });
    } else if (productIds && Array.isArray(productIds)) {
      // Belirli ürün ID'leri ile analiz
      result = await aiImageEngine.bulkAnalyze(productIds, { category, marketplaceKey });
    } else {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'productIds (array) veya count (100|500|1000|5000) zorunludur' },
      });
    }

    return res.json({
      ok: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[aiImage] Bulk analyze error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'BULK_ANALYSIS_FAILED', message: error.message || 'Toplu analiz başarısız' },
    });
  }
});

// ==================== GET /ai-image/report/:productId ====================
// Ürün bazında AI görsel raporu
aiImageRouter.get('/report/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;

    const report = await aiImageEngine.getProductReport(productId);

    if (!report) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Analiz bulunamadı' },
      });
    }

    return res.json({
      ok: true,
      data: report,
    });
  } catch (error: any) {
    console.error('[aiImage] Report error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'REPORT_ERROR', message: error.message || 'Rapor alınamadı' },
    });
  }
});

// ==================== GET /ai-image/dashboard ====================
// AI Image Center Dashboard istatistikleri
aiImageRouter.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const stats = await aiImageEngine.getDashboardStats();
    return res.json({ ok: true, data: stats });
  } catch (error: any) {
    console.error('[aiImage] Dashboard error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'DASHBOARD_ERROR', message: error.message || 'Dashboard verisi alınamadı' },
    });
  }
});

// ==================== GET /ai-image/issues ====================
// Tespit edilen sorunlar
aiImageRouter.get('/issues', requireAuth, async (req, res) => {
  try {
    const { severity, issueType, resolved, marketplace } = req.query;

    const issues = await aiImageEngine.getIssues({
      severity: severity ? String(severity) : undefined,
      issueType: issueType ? String(issueType) : undefined,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      marketplace: marketplace ? String(marketplace) : undefined,
    });

    return res.json({ ok: true, data: issues });
  } catch (error: any) {
    console.error('[aiImage] Issues error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'ISSUES_ERROR', message: error.message || 'Sorunlar alınamadı' },
    });
  }
});

// ==================== POST /ai-image/approve ====================
// Sorun onayla/reddet
aiImageRouter.post('/approve', requireAuth, async (req, res) => {
  try {
    const { issueId, approved } = req.body;

    if (!issueId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'issueId zorunludur' },
      });
    }

    await aiImageEngine.approveIssue(issueId, approved === true);

    return res.json({
      ok: true,
      message: approved ? 'Sorun onaylandı' : 'Sorun reddedildi',
    });
  } catch (error: any) {
    console.error('[aiImage] Approve error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'APPROVE_ERROR', message: error.message || 'Onaylama başarısız' },
    });
  }
});

// ==================== POST /ai-image/reanalyze ====================
// Yeniden analiz
aiImageRouter.post('/reanalyze', requireAuth, async (req, res) => {
  try {
    const { productId, imageUrl } = req.body;

    if (!productId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'productId zorunludur' },
      });
    }

    const result = await aiImageEngine.reanalyze(productId, imageUrl);

    return res.json({
      ok: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[aiImage] Reanalyze error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'REANALYSIS_FAILED', message: error.message || 'Yeniden analiz başarısız' },
    });
  }
});

// ==================== GET /ai-image/marketplace-rules ====================
// Pazaryeri görsel kuralları
aiImageRouter.get('/marketplace-rules', requireAuth, async (_req, res) => {
  try {
    const { MarketplaceImageValidator } = await import('../services/aiImage/MarketplaceImageValidator.ts');
    const rules = MarketplaceImageValidator.getAllRules();
    return res.json({ ok: true, data: rules });
  } catch (error: any) {
    console.error('[aiImage] Marketplace rules error:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'RULES_ERROR', message: error.message || 'Kurallar alınamadı' },
    });
  }
});
