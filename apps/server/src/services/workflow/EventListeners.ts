// ==================== WORKFLOW EVENT LISTENERS V1.0 ====================
// Event + WorkflowState zinciri
// KURAL 10: Sadece Event + Workflow zinciri kullanılır.
// Hiçbir yerde manuel senkronizasyon olmayacak.
// =====================================================================

import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';
import { prisma } from '../../db/prisma.ts';
import { WorkflowStateManager } from './WorkflowStateManager.ts';
import { AutoRecalculationEngine } from '../autoRecalculation/AutoRecalculationEngine.ts';
import { SummaryService } from '../autoRecalculation/SummaryService.ts';
import { DashboardService } from '../dashboard/DashboardService.ts';

/**
 * Tüm EventBus listener'larını kaydeder.
 * Uygulama başlangıcında bir kez çağrılır.
 */
export function registerWorkflowEventListeners(): void {
  console.log('[EventListeners] Workflow event listeners kaydediliyor...');

  // ==================== KATEGORİ DEĞİŞİKLİĞİ ====================
  // Cascade: Kategori → Marka → Varyant → Şablon → ReadyToSend
  EventBus.on('CategoryMatchChanged', async (event: any) => {
    const { productIds, productCount, newValue, source } = event.data;
    const correlationId = event.correlationId;
    console.log(
      `[EventListeners] CategoryMatchChanged: ${productCount} ürün, ` +
      `yeniDeğer=${newValue}, kaynak=${source} [${correlationId}]`
    );

    const startTime = Date.now();

    // WorkflowState cascade'ini başlat
    const result = await WorkflowStateManager.onModuleChanged(
      productIds,
      'CATEGORY',
      newValue,
      source
    );

    // Timeline kaydı ekle
    for (const productId of productIds) {
      await WorkflowStateManager.recordTimeline(
        productId,
        `Kategori ${newValue ? 'eşleştirildi' : 'eşleştirmesi kaldırıldı'}`,
        { source, count: productCount }
      );
    }

    // AutoRecalculation'ı tetikle
    for (const productId of productIds) {
      await AutoRecalculationEngine.onProductChanged(productId, 'category_match');
    }

    // Cache'leri temizle
    SummaryService.clearCache();
    DashboardService.clearCache();

    console.log(
      `[EventListeners] CategoryMatchChanged tamam: ` +
      `${result.updatedCount} ürün, cascade: ${result.cascadeChain.join('→')}, ` +
      `${Date.now() - startTime}ms [${correlationId}]`
    );
  });

  // ==================== MARKA DEĞİŞİKLİĞİ ====================
  // Cascade: Marka → Varyant → Şablon → ReadyToSend
  EventBus.on('BrandMatchChanged', async (event: any) => {
    const { productIds, productCount, newValue, source } = event.data;
    const correlationId = event.correlationId;
    console.log(
      `[EventListeners] BrandMatchChanged: ${productCount} ürün, ` +
      `yeniDeğer=${newValue}, kaynak=${source} [${correlationId}]`
    );

    const startTime = Date.now();

    const result = await WorkflowStateManager.onModuleChanged(
      productIds,
      'BRAND',
      newValue,
      source
    );

    // Timeline kaydı ekle
    for (const productId of productIds) {
      await WorkflowStateManager.recordTimeline(
        productId,
        `Marka ${newValue ? 'eşleştirildi' : 'eşleştirmesi kaldırıldı'}`,
        { source, count: productCount }
      );
    }

    for (const productId of productIds) {
      await AutoRecalculationEngine.onProductChanged(productId, 'brand_match');
    }

    SummaryService.clearCache();
    DashboardService.clearCache();

    console.log(
      `[EventListeners] BrandMatchChanged tamam: ` +
      `${result.updatedCount} ürün, cascade: ${result.cascadeChain.join('→')}, ` +
      `${Date.now() - startTime}ms [${correlationId}]`
    );
  });

  // ==================== VARYANT DEĞİŞİKLİĞİ ====================
  // Cascade: Varyant → Şablon → ReadyToSend
  EventBus.on('VariantMatchChanged', async (event: any) => {
    const { productIds, productCount, newValue, source } = event.data;
    const correlationId = event.correlationId;
    console.log(
      `[EventListeners] VariantMatchChanged: ${productCount} ürün, ` +
      `yeniDeğer=${newValue}, kaynak=${source} [${correlationId}]`
    );

    const startTime = Date.now();

    const result = await WorkflowStateManager.onModuleChanged(
      productIds,
      'VARIANT',
      newValue,
      source
    );

    // Timeline kaydı ekle
    for (const productId of productIds) {
      await WorkflowStateManager.recordTimeline(
        productId,
        `Varyant ${newValue ? 'eşleştirildi' : 'eşleştirmesi kaldırıldı'}`,
        { source, count: productCount }
      );
    }

    for (const productId of productIds) {
      await AutoRecalculationEngine.onProductChanged(productId, 'variant_match');
    }

    SummaryService.clearCache();
    DashboardService.clearCache();

    console.log(
      `[EventListeners] VariantMatchChanged tamam: ` +
      `${result.updatedCount} ürün, cascade: ${result.cascadeChain.join('→')}, ` +
      `${Date.now() - startTime}ms [${correlationId}]`
    );
  });

  // ==================== ŞABLON DEĞİŞİKLİĞİ ====================
  // Cascade: Şablon → ReadyToSend
  EventBus.on('TemplateMatchChanged', async (event: any) => {
    const { productIds, productCount, newValue, source } = event.data;
    const correlationId = event.correlationId;
    console.log(
      `[EventListeners] TemplateMatchChanged: ${productCount} ürün, ` +
      `yeniDeğer=${newValue}, kaynak=${source} [${correlationId}]`
    );

    const startTime = Date.now();

    const result = await WorkflowStateManager.onModuleChanged(
      productIds,
      'TEMPLATE',
      newValue,
      source
    );

    // Timeline kaydı ekle
    for (const productId of productIds) {
      await WorkflowStateManager.recordTimeline(
        productId,
        `Şablon ${newValue ? 'eşleştirildi' : 'eşleştirmesi kaldırıldı'}`,
        { source, count: productCount }
      );
    }

    for (const productId of productIds) {
      await AutoRecalculationEngine.onProductChanged(productId, 'template_match');
    }

    SummaryService.clearCache();
    DashboardService.clearCache();

    console.log(
      `[EventListeners] TemplateMatchChanged tamam: ` +
      `${result.updatedCount} ürün, cascade: ${result.cascadeChain.join('→')}, ` +
      `${Date.now() - startTime}ms [${correlationId}]`
    );
  });

  // ==================== WORKFLOW STATE DEĞİŞİKLİĞİ ====================
  EventBus.on('WorkflowStateChanged', async (event: any) => {
    const d = event.data;
    console.log(
      `[EventListeners] WorkflowStateChanged: ürün=${d.productId}, ` +
      `${d.oldStatus}→${d.newStatus}, ` +
      `readiness: ${d.oldReadiness}→${d.newReadiness}, ` +
      `değişenAlanlar: ${d.changedFields.join(',')} [${event.correlationId}]`
    );
  });

  // ==================== STOK DEĞİŞİKLİĞİ ====================
  // XML Import → StockChanged → WorkflowState → StockProtection
  EventBus.on('ProductStockChanged', async (event: any) => {
    const { products, xmlSourceId, totalProducts } = event.data;
    const correlationId = event.correlationId;
    console.log(
      `[EventListeners] ProductStockChanged: ${totalProducts} ürün, ` +
      `XML kaynağı: ${xmlSourceId} [${correlationId}]`
    );

    const startTime = Date.now();

    for (const product of products) {
      // WorkflowState'i stok durumuna göre güncelle
      const product2 = await prisma.product.findUnique({
        where: { id: product.productId },
        select: { id: true, criticalStockLevel: true, minStock: true },
      });
      if (product2) {
        const criticalLevel = product2.criticalStockLevel ?? product2.minStock ?? 3;
        await WorkflowStateManager.updateStockStatus(
          product.productId,
          product.newStock,
          criticalLevel
        );
      }
    }

    // Cache'leri temizle
    SummaryService.clearCache();
    DashboardService.clearCache();

    console.log(
      `[EventListeners] ProductStockChanged tamam: ` +
      `${totalProducts} ürün işlendi, ${Date.now() - startTime}ms [${correlationId}]`
    );
  });

  // ==================== DASHBOARD YENİLEME ====================
  EventBus.on('DashboardRefresh', async (event: any) => {
    SummaryService.clearCache();
    DashboardService.clearCache();
    console.log(
      `[EventListeners] DashboardRefresh: ${event.data.reason} [${event.correlationId}]`
    );
  });

  console.log('[EventListeners] Tüm workflow event listeners kaydedildi.');
}
