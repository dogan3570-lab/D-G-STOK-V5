// ==================== DASHBOARD SERVICE V2.0 ====================
// Anayasa Madde 6: Ortak Gosterge Motoru
// Bu servis artik SummaryService'e yonelir.
// Kendi COUNT sorgusunu YAZMAZ, SummaryService'ten alir.
// Dashboard, Kontrol Merkezi, Urun Havuzu, Raporlar, Gonderime Hazir
// hep ayni kaynaktan beslenir.
// =================================================================

import { SummaryService } from '../autoRecalculation/SummaryService.ts';
import type { ProductSummary } from '../autoRecalculation/SummaryService.ts';
import { prisma } from '../../db/prisma.ts';

// ==================== TİP TANIMLARI ====================

export interface DashboardSummary {
  products: {
    total: number;
    active: number;
    passive: number;
    outOfStock: number;
    error: number;
    manualReview: number;
    ready: number;
  };
  xml: {
    totalSources: number;
    activeSources: number;
    passiveSources: number;
    errorSources: number;
    todayImports: number;
    lastImportAt: string | null;
    lastImportStatus: string | null;
  };
  marketplaces: Array<{
    id: string;
    name: string;
    key: string;
    apiStatus: string;
    connected: boolean;
    lastSyncAt: string | null;
    totalSent: number;
    totalErrors: number;
    totalReady: number;
  }>;
  variants: { total: number; matched: number; manualReview: number; error: number; pending: number };
  errors: { missingCategory: number; missingBrand: number; missingVariant: number; missingBarcode: number; apiErrors: number; total: number };
  timestamp: string;
  cached: boolean;
}

export interface ActivityEvent {
  id: string;
  type: 'xml_import' | 'product_update' | 'api_send' | 'api_error' | 'stock_alert' | 'system';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'info' | 'warning';
}

export class DashboardService {

  /**
   * Dashboard ozetini dondurur.
   * Urun KPI'lari SummaryService'ten alinir (TEK KAYNAK).
   * XML/Pazaryeri/Varyant bilgileri eklenir.
   */
  static async getSummary(): Promise<DashboardSummary> {
    const productSummary: ProductSummary = await SummaryService.getSummary();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalXmlSources, activeXmlSources, passiveXmlSources, errorXmlSources,
      todayImports, lastImport, brandCount, variantCount,
      marketplaces, marketplaceStates, variantStatuses,
    ] = await Promise.all([
      prisma.xmlSource.count(),
      prisma.xmlSource.count({ where: { active: true } }),
      prisma.xmlSource.count({ where: { active: false } }),
      prisma.xmlSource.count({ where: { connectionStatus: 'error' } }),
      prisma.xmlImportRun.count({ where: { startedAt: { gte: todayStart } } }),
      prisma.xmlImportRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.brand.count(),
      prisma.variant.count(),
      prisma.marketplace.findMany(),
      prisma.productMarketplaceState.groupBy({ by: ['marketplaceId', 'status'], _count: { status: true } }),
      prisma.product.groupBy({ by: ['variantStatus'], _count: { variantStatus: true } }),
    ]);

    const marketplaceData = marketplaces.map(mp => {
      const states = marketplaceStates.filter(s => s.marketplaceId === mp.id);
      return {
        id: mp.id, name: mp.name, key: mp.key, apiStatus: mp.apiStatus,
        connected: mp.apiStatus === 'ok' || mp.apiStatus === 'connected',
        lastSyncAt: mp.updatedAt.toISOString(),
        totalSent: states.find(s => s.status === 'SENT')?._count.status ?? 0,
        totalErrors: states.find(s => s.status === 'ERROR')?._count.status ?? 0,
        totalReady: states.find(s => s.status === 'READY')?._count.status ?? 0,
      };
    });

    const variantManualReview = variantStatuses
      .filter(v => ['MANUAL_REVIEW', 'PENDING', 'WAITING_AI'].includes(v.variantStatus ?? ''))
      .reduce((sum, v) => sum + v._count.variantStatus, 0);
    const variantError = variantStatuses
      .filter(v => ['ERROR', 'PASSIVE'].includes(v.variantStatus ?? ''))
      .reduce((sum, v) => sum + v._count.variantStatus, 0);
    const variantMatched = variantStatuses
      .filter(v => ['AUTO_ACCEPTED', 'VARIANTSIZ_KABUL', 'READY', 'SENT'].includes(v.variantStatus ?? ''))
      .reduce((sum, v) => sum + v._count.variantStatus, 0);
    const variantPending = variantStatuses
      .filter(v => ['XML'].includes(v.variantStatus ?? ''))
      .reduce((sum, v) => sum + v._count.variantStatus, 0);

    return {
      products: {
        total: productSummary.totalProducts,
        active: productSummary.activeProducts,
        passive: productSummary.passiveProducts,
        outOfStock: productSummary.missingStock,
        error: productSummary.errorProducts,
        manualReview: variantManualReview,
        ready: productSummary.readyForListing,
      },
      xml: {
        totalSources: totalXmlSources, activeSources: activeXmlSources,
        passiveSources: passiveXmlSources, errorSources: errorXmlSources,
        todayImports, lastImportAt: lastImport?.startedAt.toISOString() ?? null,
        lastImportStatus: lastImport?.status ?? null,
      },
      marketplaces: marketplaceData,
      variants: { total: variantCount, matched: variantMatched, manualReview: variantManualReview, error: variantError, pending: variantPending },
      errors: {
        missingCategory: productSummary.pendingCategory,
        missingBrand: productSummary.pendingBrand,
        missingVariant: variantPending,
        missingBarcode: productSummary.missingBarcode,
        apiErrors: errorXmlSources,
        total: productSummary.pendingCategory + productSummary.pendingBrand + variantPending + productSummary.missingBarcode + errorXmlSources,
      },
      timestamp: new Date().toISOString(),
      cached: false,
    };
  }

  static async getActivity(limit = 20): Promise<ActivityEvent[]> {
    const events: ActivityEvent[] = [];
    const recentImports = await prisma.xmlImportRun.findMany({
      take: limit, orderBy: { startedAt: 'desc' },
      include: { source: { select: { name: true } } },
    });
    for (const imp of recentImports) {
      events.push({
        id: `xml-${imp.id}`,
        type: imp.status === 'error' ? 'api_error' : 'xml_import',
        title: `XML ${imp.status === 'completed' ? 'aktarimi tamamlandi' : imp.status === 'running' ? 'aktarimi basladi' : 'aktarimi basarisiz'}`,
        description: `${imp.totalProducts ?? 0} urun (${imp.source?.name ?? 'bilinmeyen'})`,
        timestamp: imp.startedAt.toISOString(),
        status: imp.status === 'completed' ? 'success' : imp.status === 'error' ? 'error' : 'info',
      });
    }
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, limit);
  }

  static clearCache(): void {
    SummaryService.clearCache();
  }
}
