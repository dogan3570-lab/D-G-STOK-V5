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
      totalProducts,
      missingCategory, missingBrand, missingVariant, missingTemplate,
    ] = await Promise.all([
      // WorkflowState'den tek sorgu
      prisma.workflowState.groupBy({
        by: ['status'],
        _count: { status: true },
        _avg: { readiness: true },
      }),
      
      // Ürün sayısı (WorkflowState kaydı olan ürünler)
      prisma.workflowState.count(),

      // Eksik bilgiler (WorkflowState üzerinden)
      prisma.workflowState.count({ where: { stepCategory: 'MISSING' } }),
      prisma.workflowState.count({ where: { stepBrand: 'MISSING' } }),
      prisma.workflowState.count({ where: { stepVariant: 'MISSING' } }),
      prisma.workflowState.count({ where: { stepTitle: 'MISSING' } }),
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

    const readyCount = statusMap['READY'] || 0;
    const needsReviewCount = statusMap['NEEDS_REVIEW'] || 0;
    const hasIssuesCount = statusMap['HAS_ISSUES'] || 0;
    const cannotSendCount = statusMap['CANNOT_SEND'] || 0;
    const passiveCount = statusMap['PASSIVE'] || 0;

    // missingInfo = En az bir adımı eksik olanlar
    const missingInfo = totalProducts - readyCount;

    const data: ProductSummary = {
      totalProducts,
      activeProducts: readyCount + needsReviewCount,
      passiveProducts: passiveCount,
      errorProducts: cannotSendCount,
      draftProducts: 0,
      
      // WorkflowState bazlı
      readyForListing: readyCount,
      publishedProducts: readyCount,
      pendingProducts: needsReviewCount + hasIssuesCount,
      rejectedProducts: cannotSendCount,
      
      // WorkflowState'den eksik bilgiler
      missingInfo,
      pendingCategory: missingCategory,
      pendingBrand: missingBrand,
      pendingVariant: missingVariant,
      pendingTemplate: missingTemplate,
      missingImages: 0,
      missingBarcode: 0,
      missingDescription: 0,
      missingPrice: 0,
      missingStock: 0,
      missingSeo: 0,
      variantAnalysisPending: 0,

      // WorkflowState KPI'ları
      workflowReady: readyCount,
      workflowNeedsReview: needsReviewCount,
      workflowHasIssues: hasIssuesCount,
      workflowCannotSend: cannotSendCount,
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
