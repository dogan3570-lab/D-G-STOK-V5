// ==================== AI SALES & PROFIT ADVISOR REST API V1 ====================
// DG STOK V5.0 - AI Satış ve Karlılık Asistanı API'leri
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { AISalesAdvisor } from '../services/aiSales/AISalesAdvisor.ts';

export const aiSalesRouter = Router();

const aiSalesAdvisor = new AISalesAdvisor();

// POST /ai-sales/analyze - Tek ürün analizi
aiSalesRouter.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { productId, marketplaceKey } = req.body;
    if (!productId) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'productId zorunludur' } });
    }
    const result = await aiSalesAdvisor.analyze(productId, marketplaceKey);
    return res.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('[aiSales] Analyze error:', error);
    return res.status(500).json({ ok: false, error: { code: 'ANALYSIS_FAILED', message: error.message } });
  }
});

// POST /ai-sales/bulk-analyze - Toplu analiz
aiSalesRouter.post('/bulk-analyze', requireAuth, async (req, res) => {
  try {
    const { productIds, count, marketplaceKey } = req.body;
    let result;
    if (count) {
      result = await aiSalesAdvisor.analyzeByCount(Number(count), marketplaceKey);
    } else if (productIds && Array.isArray(productIds)) {
      result = await aiSalesAdvisor.bulkAnalyze(productIds, marketplaceKey);
    } else {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'productIds veya count zorunludur' } });
    }
    return res.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('[aiSales] Bulk analyze error:', error);
    return res.status(500).json({ ok: false, error: { code: 'BULK_ANALYSIS_FAILED', message: error.message } });
  }
});

// GET /ai-sales/report/:productId - Ürün raporu
aiSalesRouter.get('/report/:productId', requireAuth, async (req, res) => {
  try {
    const report = await aiSalesAdvisor.getProductReport(req.params.productId);
    if (!report) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Rapor bulunamadı' } });
    return res.json({ ok: true, data: report });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'REPORT_ERROR', message: error.message } });
  }
});

// GET /ai-sales/dashboard - Dashboard
aiSalesRouter.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const stats = await aiSalesAdvisor.getDashboardStats();
    return res.json({ ok: true, data: stats });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'DASHBOARD_ERROR', message: error.message } });
  }
});

// GET /ai-sales/recommendations - Öneriler
aiSalesRouter.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const { marketplace, risk, recommendation } = req.query;
    const result = await aiSalesAdvisor.getRecommendations({
      marketplace: marketplace ? String(marketplace) : undefined,
      risk: risk ? String(risk) : undefined,
      recommendation: recommendation ? String(recommendation) : undefined,
    });
    return res.json({ ok: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'RECOMMENDATIONS_ERROR', message: error.message } });
  }
});

// POST /ai-sales/approve - Öneri onayla/reddet
aiSalesRouter.post('/approve', requireAuth, async (req, res) => {
  try {
    const { reportId, approved } = req.body;
    if (!reportId) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'reportId zorunludur' } });
    await aiSalesAdvisor.approveRecommendation(reportId, approved === true);
    return res.json({ ok: true, message: approved ? 'Öneri onaylandı, fiyat güncellendi' : 'Öneri reddedildi' });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'APPROVE_ERROR', message: error.message } });
  }
});

// POST /ai-sales/recalculate - Yeniden hesapla
aiSalesRouter.post('/recalculate', requireAuth, async (req, res) => {
  try {
    const { productId, marketplaceKey } = req.body;
    if (!productId) return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'productId zorunludur' } });
    const result = await aiSalesAdvisor.recalculate(productId, marketplaceKey);
    return res.json({ ok: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'RECALCULATE_ERROR', message: error.message } });
  }
});
