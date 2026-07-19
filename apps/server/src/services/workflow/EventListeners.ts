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
import { ReadyToSendEngine } from '../readyToSend/ReadyToSendEngine.ts';

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

    // Pipeline: WorkflowState READY olursa ReadyToSendEngine tetiklenir
    if (d.newStatus === 'READY' || (d.newReadiness >= 100 && d.oldReadiness < 100)) {
      try {
        const rts = await ReadyToSendEngine.checkProduct(d.productId);
        if (rts.ready) {
          await WorkflowStateManager.recordTimeline(
            d.productId, 'Ready To Send',
            { score: rts.score, checks: Object.keys(rts.checks).filter(k => (rts.checks as any)[k]) }
          );
          console.log(`[Pipeline] Urun hazir: ${d.productId} (skor: ${rts.score}) [${event.correlationId}]`);
        }
      } catch (e) {
        console.error(`[Pipeline] ReadyToSend kontrol hatasi: ${d.productId}`, e);
      }
    }
  });

  // ==================== XML IMPORT TAMAMLANDI ====================
  // XML import sonrasi pipeline otomatik baslar
  EventBus.on('ProductImportCompleted', async (event: any) => {
    const { productIds, sourceName, totalItems } = event.data;
    const correlationId = event.correlationId;
    console.log(
      `[EventListeners] ProductImportCompleted: ${totalItems} ürün, ` +
      `kaynak: ${sourceName} [${correlationId}]`
    );

    const startTime = Date.now();

    // Her urun icin WorkflowState olustur
    for (const productId of productIds) {
      await prisma.workflowState.upsert({
        where: { productId },
        update: { status: 'XML_IMPORTED' },
        create: { productId, status: 'XML_IMPORTED', readiness: 10 },
      });
      await WorkflowStateManager.recordTimeline(
        productId, 'XML Imported',
        { source: sourceName, correlationId }
      );
    }

    // AutoRecalculation tetikle
    for (const productId of productIds) {
      await AutoRecalculationEngine.onProductChanged(productId, 'xml_import');
    }

    SummaryService.clearCache();
    DashboardService.clearCache();

    console.log(
      `[EventListeners] ProductImportCompleted tamam: ` +
      `${totalItems} ürün, ${Date.now() - startTime}ms [${correlationId}]`
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

  // ==================== READY_TOSEND OTOMATİK TETİKLEME ====================
  // Cascade sonrasi WorkflowState READY olursa ReadyToSendEngine tetiklenir
  EventBus.on('WorkflowStateChanged', async (event: any) => {
    const d = event.data;
    if (d.newStatus === 'READY') {
      // ReadyToSendEngine otomatik kontrol
      const rts = await ReadyToSendEngine.checkProduct(d.productId);
      if (rts.ready) {
        await WorkflowStateManager.recordTimeline(
          d.productId, 'Ready To Send',
          { score: rts.score, checks: rts.checks }
        );
        console.log(`[Pipeline] Urun hazir: ${d.productId} (skor: ${rts.score})`);
      }
    }
  });

  // ==================== AI IMAGE EVENT LISTENER'LARI ====================
  EventBus.on('ImageAnalyzed', async (event: any) => {
    const { productId, totalImages, passCount, failCount, score } = event.data;
    await prisma.auditLog.create({
      data: {
        action: 'AI_IMAGE_ANALYZED',
        entity: 'Product',
        entityId: productId,
        details: JSON.stringify({ totalImages, passCount, failCount, score }),
        success: true,
      },
    });
    SummaryService.clearCache();
    DashboardService.clearCache();
  });

  EventBus.on('ImageIssueDetected', async (event: any) => {
    const { productId, issues } = event.data;
    // AI Command Center'a issue olarak ekle
    await prisma.aIIssue.create({
      data: { productId, severity: 'HIGH', description: JSON.stringify(issues || []) },
    });
    SummaryService.clearCache();
  });

  EventBus.on('ImageApproved', async (event: any) => {
    await prisma.auditLog.create({
      data: { action: 'AI_IMAGE_APPROVED', entity: 'Product', entityId: event.data.productId, success: true },
    });
    SummaryService.clearCache();
  });

  EventBus.on('ImageRejected', async (event: any) => {
    await prisma.auditLog.create({
      data: { action: 'AI_IMAGE_REJECTED', entity: 'Product', entityId: event.data.productId, success: false },
    });
    SummaryService.clearCache();
  });

  // ==================== AI SALES EVENT LISTENER'LARI ====================
  EventBus.on('PriceRecommendationCreated', async (event: any) => {
    SummaryService.clearCache();
    DashboardService.clearCache();
    await prisma.auditLog.create({
      data: { action: 'AI_PRICE_RECOMMENDATION', entity: 'Product', entityId: event.data.productId, success: true },
    });
  });

  EventBus.on('PriceRecommendationApproved', async (event: any) => {
    SummaryService.clearCache();
    await WorkflowStateManager.syncFromProduct(event.data.productId);
  });

  EventBus.on('PriceRecommendationRejected', async (event: any) => {
    await prisma.auditLog.create({
      data: { action: 'AI_PRICE_REJECTED', entity: 'Product', entityId: event.data.productId, success: false },
    });
  });

  EventBus.on('ProfitChanged', async (event: any) => {
    SummaryService.clearCache();
    DashboardService.clearCache();
    // WorkflowState'de price adımını güncelle
    await WorkflowStateManager.syncFromProduct(event.data.productId);
  });

  // ==================== AI COPILOT EVENT LISTENER'LARI ====================
  EventBus.on('CopilotRequested', async (event: any) => {
    await prisma.auditLog.create({
      data: {
        action: 'COPILOT_REQUEST',
        entity: 'Copilot',
        details: `Sorgu: ${event.data?.query?.substring(0, 100)}`,
        success: true,
      },
    });
  });

  EventBus.on('CopilotTaskStarted', async (event: any) => {
    await WorkflowStateManager.recordTimeline(
      event.data.productId || 'system',
      `Copilot görevi başladı: ${event.data.taskType}`,
      { taskId: event.data.taskId }
    );
  });

  EventBus.on('CopilotTaskCompleted', async (event: any) => {
    SummaryService.clearCache();
    DashboardService.clearCache();
    await prisma.auditLog.create({
      data: { action: 'COPILOT_COMPLETED', entity: 'Copilot', details: event.data.result, success: true },
    });
  });

  EventBus.on('CopilotTaskFailed', async (event: any) => {
    await prisma.auditLog.create({
      data: { action: 'COPILOT_FAILED', entity: 'Copilot', details: event.data.error, success: false },
    });
    // AI Command Center'a issue olarak ekle
    if (event.data.productId) {
      await prisma.aIIssue.create({
        data: { productId: event.data.productId, severity: 'CRITICAL', description: event.data.error },
      });
    }
  });

  // ==================== STOCK PROTECTION EVENT LISTENER'LARI ====================
  EventBus.on('HealthScoreUpdated', async (event: any) => {
    const { productId, score } = event.data;
    await WorkflowStateManager.syncFromProduct(productId);
    SummaryService.clearCache();
  });

  EventBus.on('StockProtectionDecision', async (event: any) => {
    const { productId, decision, marketplaceKey } = event.data;
    await WorkflowStateManager.recordTimeline(
      productId,
      `Stok koruma: ${decision === 'CLOSE' ? 'İlan kapatıldı' : 'İlan açıldı'} (${marketplaceKey})`,
      { decision }
    );
    SummaryService.clearCache();
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
