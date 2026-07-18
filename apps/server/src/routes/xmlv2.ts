// ==================== XML MOTORU V2 - API ROUTE'LARI ====================
// DG STOK V5.0 - Faz 1
// ========================================================================

import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { generateXmlQualityReport } from '../services/xmlv2/QualityEngine.ts';
import { analyzeVariantV2, isVariantEngineV2Enabled } from '../services/xmlv2/VariantEngineV2.ts';
import { logVariantDecision } from '../services/xmlv2/DecisionLogger.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import type { VariantAnalysisInput } from '../services/xmlv2/VariantEngineV2.ts';
import type { XmlQualityReport } from '../services/xmlv2/types.ts';

export const xmlv2Router = Router();

// ==================== KALITE RAPORU ====================

// GET /api/xmlv2/quality/:sourceId - XML kalite raporu
xmlv2Router.get('/quality/:sourceId', requireAuth, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const report = await generateXmlQualityReport(sourceId);
    if (!report) {
      return res.status(404).json({ ok: false, error: 'XML kaynagi bulunamadi' });
    }
    return res.json({ ok: true, report });
  } catch (error) {
    console.error('[XmlV2] Quality report error:', error);
    return res.status(500).json({ ok: false, error: 'Kalite raporu olusturulamadi' });
  }
});

// GET /api/xmlv2/quality - Tum XML kaynaklarinin kalite ozeti
xmlv2Router.get('/quality', requireAuth, async (_req, res) => {
  try {
    const sources = await prisma.xmlSource.findMany({
      select: { id: true, name: true, sourceType: true, _count: { select: { products: true } } },
    });

    const summaries = await Promise.all(
      sources.map(async (source) => {
        try {
          const report = await generateXmlQualityReport(source.id);
          if (!report) return null;
          return {
            id: source.id,
            name: source.name,
            type: source.sourceType,
            totalProducts: report.totalProducts,
            overallScore: report.overallScore.overall,
            readinessRate: report.summary.readinessRate,
            perfect: report.summary.perfect,
            good: report.summary.good,
            warning: report.summary.warning,
            error: report.summary.error,
          };
        } catch {
          return null;
        }
      })
    );

    return res.json({ ok: true, items: summaries.filter(Boolean) });
  } catch (error) {
    console.error('[XmlV2] Quality summary error:', error);
    return res.status(500).json({ ok: false, error: 'Kalite ozeti alinamadi' });
  }
});

// ==================== VARYANT ANALIZI ====================

// POST /api/xmlv2/variant/analyze - Varyant analizi
xmlv2Router.post('/variant/analyze', requireAuth, async (req, res) => {
  try {
    if (!isVariantEngineV2Enabled()) {
      return res.status(400).json({
        ok: false,
        error: 'Variant Engine V2 aktif degil. VARIANT_ENGINE=v2 olarak ayarlayin',
      });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ ok: false, error: 'productId zorunludur' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { select: { name: true, value: true } },
        marketplaceStates: { select: { marketplace: { select: { key: true } }, status: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ ok: false, error: 'Urun bulunamadi' });
    }

    const input: VariantAnalysisInput = {
      productId: product.id,
      xmlKey: product.xmlKey,
      title: product.title,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.categoryId,
      brandId: product.brandId,
      description: product.description,
      xmlSourceId: product.xmlSourceId,
      existingVariants: product.variants.map(v => ({ name: v.name, value: v.value })),
      marketplaceState: product.marketplaceStates.map(s => ({
        marketplaceKey: s.marketplace.key,
        status: s.status,
      })),
    };

    const result = await analyzeVariantV2(input);

    // Karari logla
    await logVariantDecision(
      productId,
      result.decision,
      result.reason,
      result.confidence,
      result.decision !== 'MANUAL_REVIEW'
    );

    return res.json({ ok: true, result });
  } catch (error) {
    console.error('[XmlV2] Variant analysis error:', error);
    return res.status(500).json({ ok: false, error: 'Varyant analizi basarisiz' });
  }
});

// POST /api/xmlv2/variant/batch-analyze - Toplu varyant analizi
xmlv2Router.post('/variant/batch-analyze', requireAuth, async (req, res) => {
  try {
    if (!isVariantEngineV2Enabled()) {
      return res.status(400).json({
        ok: false,
        error: 'Variant Engine V2 aktif degil',
      });
    }

    const { sourceId } = req.body;
    if (!sourceId) {
      return res.status(400).json({ ok: false, error: 'sourceId zorunludur' });
    }

    const products = await prisma.product.findMany({
      where: { xmlSourceId: sourceId },
      include: {
        variants: { select: { name: true, value: true } },
        marketplaceStates: { select: { marketplace: { select: { key: true } }, status: true } },
      },
      take: 10000,
    });

    const results = [];
    for (const product of products) {
      const input: VariantAnalysisInput = {
        productId: product.id,
        xmlKey: product.xmlKey,
        title: product.title,
        sku: product.sku,
        barcode: product.barcode,
        categoryId: product.categoryId,
        brandId: product.brandId,
        description: product.description,
        xmlSourceId: product.xmlSourceId,
        existingVariants: product.variants.map(v => ({ name: v.name, value: v.value })),
        marketplaceState: product.marketplaceStates.map(s => ({
          marketplaceKey: s.marketplace.key,
          status: s.status,
        })),
      };

      const result = await analyzeVariantV2(input);
      results.push(result);
    }

    const summary = {
      total: results.length,
      autoAccepted: results.filter(r => r.decision === 'AUTO_ACCEPTED').length,
      autoCreated: results.filter(r => r.decision === 'AUTO_CREATED').length,
      variantsizKabul: results.filter(r =>
        ['VARIANTSIZ_KABUL', 'NO_VARIANT_NEEDED'].includes(r.decision)
      ).length,
      manualReview: results.filter(r => r.decision === 'MANUAL_REVIEW').length,
    };

    return res.json({ ok: true, summary, results });
  } catch (error) {
    console.error('[XmlV2] Batch variant analysis error:', error);
    return res.status(500).json({ ok: false, error: 'Toplu varyant analizi basarisiz' });
  }
});

// ==================== XML MOTORU DURUMU ====================

// GET /api/xmlv2/status - Motor durumu
xmlv2Router.get('/status', (_req, res) => {
  res.json({
    ok: true,
    variantEngine: isVariantEngineV2Enabled() ? 'v2' : 'v4 (default)',
    variantEngineV2Enabled: isVariantEngineV2Enabled(),
    version: '2.0.0',
    features: [
      'quality-engine',
      'variant-engine-v2',
      'decision-logger',
      'data-health-center',
    ],
  });
});
