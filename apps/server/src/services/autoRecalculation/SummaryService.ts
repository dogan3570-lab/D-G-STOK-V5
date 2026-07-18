// ==================== SUMMARY SERVICE V2.0 ====================
// Merkezi Ozet Servisi
// KURAL 3: Dashboard, Ürün Hazırlama, Gönderime Hazır aynı veriyi gösterir.
// KURAL 4: Hiçbir modül kendi başına hesap yapmaz. TEK KAYNAK: WorkflowState
// ============================================================

import { prisma } from '../../db/prisma.ts';

export interface ProductSummary {
  // Temel sayilar
  totalProducts: number;
  activeProducts: number;
  passiveProducts: number;
  errorProducts: number;
  draftProducts: number;

  // ReadyToSend KPI'lari
  readyForListing: number;
  publishedProducts: number;
  pendingProducts: number;
  rejectedProducts: number;

  // Eksik bilgiler (WorkflowState'den)
  missingInfo: number;
  pendingCategory: number;
  pendingBrand: number;
  pendingVariant: number;
  pendingTemplate: number;
  missingImages: number;
  missingBarcode: number;
  missingDescription: number;
  missingPrice: number;
  missingStock: number;
  missingSeo: number;
  variantAnalysisPending: number;

  // WorkflowState bazlı KPI'lar
  workflowReady: number;
  workflowNeedsReview: number;
  workflowHasIssues: number;
  workflowCannotSend: number;
  avgReadiness: number;

  // Zaman bilgisi
  timestamp: string;
}

let summaryCache: { data: ProductSummary; timestamp: number } | null = null;
const CACHE_TTL = 30_000; // 30 saniye

export class SummaryService {
  /**
   * Ana ozet bilgisini dondurur.
   * TEK KAYNAK: WorkflowState
   * Dashboard, Ürün Hazırlama, Gönderime Hazır - hepsi bu metodu kullanır.
   */
  static async getSummary(): Promise<ProductSummary> {
    // Cache kontrol
    if (summaryCache && Date.now() - summaryCache.timestamp < CACHE_TTL) {
      return summaryCache.data;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ===== TEK KAYNAK: WorkflowState =====
    const [
      workflowStats,
      totalProducts, activeProducts, passiveProducts, draftProducts,
      errorProducts, newToday,
      missingImages, missingBarcode, missingDescription,
      missingPrice, missingStock, missingSeo,
      publishedProducts, pendingProductsCount, rejectedProducts,
    ] = await Promise.all([
      // WorkflowState'den tek sorgu
      prisma.workflowState.groupBy({
        by: ['status'],
        _count: { status: true },
        _avg: { readiness: true },
      }),
      
      // Product temel sayıları
      prisma.product.count(),
      prisma.product.count({ where: { status: 'READY' } }),
      prisma.product.count({ where: { status: 'PASSIVE' } }),
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.product.count({ where: { createdAt: { gte: todayStart } } }),

      // Eksik bilgiler (Product'tan - çünkü bunlar WorkflowState'de yok)
      prisma.product.count({ where: { images: null } }),
      prisma.product.count({ where: { barcode: null } }),
      prisma.product.count({ where: { description: null } }),
      prisma.product.count({ where: { salePrice: null } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { seoTitle: null, seoDescription: null } }),

      // ReadyToSend ek KPI'lari
      prisma.product.count({ where: { status: 'PUBLISHED' } }),
      prisma.product.count({ where: { status: 'PENDING' } }),
      prisma.product.count({ where: { status: 'REJECTED' } }),
    ]);

    // WorkflowState'den KPI'lar
    const statusMap: Record<string, number> = {};
    let readinessTotal = 0;
    let readinessCount = 0;
    for (const s of workflowStats) {
      statusMap[s.status] = s._count.status;
      if (s._avg.readiness !== null) {
        readinessTotal += s._avg.readiness * s._count.status;
        readinessCount += s._count.status;
      }
    }

    const workflowReady = statusMap['READY'] || 0;
    const workflowNeedsReview = statusMap['NEEDS_REVIEW'] || 0;
    const workflowHasIssues = statusMap['HAS_ISSUES'] || 0;
    const workflowCannotSend = statusMap['CANNOT_SEND'] || 0;

    // WorkflowState'den eksik bilgiler (TEK KAYNAK)
    const [pendingCategory, pendingBrand, pendingVariant, pendingTemplate] = await Promise.all([
      prisma.workflowState.count({ where: { stepCategory: 'MISSING' } }),
      prisma.workflowState.count({ where: { stepBrand: 'MISSING' } }),
      prisma.workflowState.count({ where: { stepVariant: 'MISSING' } }),
      prisma.workflowState.count({ where: { stepTitle: 'MISSING' } }),
    ]);

    // readyForListing = Tüm adımları tamam olanlar (WorkflowState)
    const readyForListing = workflowReady;

    // missingInfo = En az bir adımı eksik olanlar
    const missingInfo = (await prisma.workflowState.count()) - workflowReady;

    const data: ProductSummary = {
      totalProducts,
      activeProducts,
      passiveProducts,
      errorProducts,
      draftProducts,
      
      // WorkflowState bazlı
      readyForListing,
      publishedProducts,
      pendingProducts: pendingProductsCount,
      rejectedProducts,
      
      // WorkflowState'den eksik bilgiler
      missingInfo,
      pendingCategory,
      pendingBrand,
      pendingVariant,
      pendingTemplate,
      missingImages,
      missingBarcode,
      missingDescription,
      missingPrice,
      missingStock,
      missingSeo,
      variantAnalysisPending: 0,

      // WorkflowState KPI'ları
      workflowReady,
      workflowNeedsReview,
      workflowHasIssues,
      workflowCannotSend,
      avgReadiness: readinessCount > 0 ? Math.round(readinessTotal / readinessCount) : 0,

      timestamp: new Date().toISOString(),
    };

    summaryCache = { data, timestamp: Date.now() };
    return data;
  }

  /**
   * Cache'i temizle - her degisiklik sonrasi cagrilir
   */
  static clearCache(): void {
    summaryCache = null;
  }
}
