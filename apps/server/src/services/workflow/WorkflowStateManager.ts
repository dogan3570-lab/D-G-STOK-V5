// ==================== WORKFLOW STATE MANAGER V2.0 ====================
// DG STOK V5.0 - Merkezi WorkflowState Yönetim Sistemi
//
// KURAL 6: Kategori değişirse → Marka, Varyant, Şablon yeniden hesaplanır
// KURAL 7: Marka değişirse → Varyant, Şablon yeniden hesaplanır
// KURAL 8: Varyant değişirse → Şablon yeniden hesaplanır
// KURAL 9: Şablon değişirse → ReadyToSend yeniden hesaplanır
//
// TEK KAYNAK: WorkflowState
// Hiçbir modül kendi başına hesap yapmaz.
// =====================================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';
import type { WorkflowStepStatus } from './types.ts';

// ==================== TİP TANIMLARI ====================

export type ModuleType = 'CATEGORY' | 'BRAND' | 'VARIANT' | 'TEMPLATE' | 'READY_TO_SEND';

/**
 * Cascade kuralı: Hangi modül hangi modülleri resetler?
 * KURAL 6-9 arasındaki cascade zinciri
 */
const CASCADE_RULES: Record<ModuleType, ModuleType[]> = {
  CATEGORY: ['BRAND', 'VARIANT', 'TEMPLATE', 'READY_TO_SEND'],
  BRAND: ['VARIANT', 'TEMPLATE', 'READY_TO_SEND'],
  VARIANT: ['TEMPLATE', 'READY_TO_SEND'],
  TEMPLATE: ['READY_TO_SEND'],
  READY_TO_SEND: [],
};

/**
 * Her modülün WorkflowState'deki alan adı
 */
const MODULE_FIELD_MAP: Record<ModuleType, string> = {
  CATEGORY: 'stepCategory',
  BRAND: 'stepBrand',
  VARIANT: 'stepVariant',
  TEMPLATE: 'stepTitle',
  READY_TO_SEND: 'status',
};

/**
 * Modül sıralaması (readiness hesaplama için)
 */
const MODULE_ORDER: ModuleType[] = ['CATEGORY', 'BRAND', 'VARIANT', 'TEMPLATE', 'READY_TO_SEND'];

export class WorkflowStateManager {
  private static processing = new Set<string>();

  // ==================== ANA CASCADE METODU ====================

  /**
   * Bir modül tamamlandığında çağrılır.
   * Cascade kurallarına göre alt modülleri resetler ve
   * WorkflowState'i günceller.
   *
   * @param productIds - Etkilenen ürün ID'leri
   * @param triggerModule - Hangi modül tetikledi?
   * @param newValue - Yeni değer (true = tamam, false = reset)
   * @param source - Kaynak (ai | manual | bulk | auto)
   */
  static async onModuleChanged(
    productIds: string[],
    triggerModule: ModuleType,
    newValue: boolean,
    source: string = 'manual'
  ): Promise<{
    updatedCount: number;
    cascadeChain: ModuleType[];
    affectedModules: ModuleType[];
    logEntries: Array<{ productId: string; event: string; details: any }>;
  }> {
    const correlationId = createCorrelationId('WF');
    const timestamp = new Date().toISOString();
    const cascadeChain = CASCADE_RULES[triggerModule] || [];
    const logEntries: Array<{ productId: string; event: string; details: any }> = [];

    console.log(
      `[WorkflowStateManager] Başladı: trigger=${triggerModule}, ` +
      `products=${productIds.length}, newValue=${newValue}, ` +
      `cascade=${cascadeChain.join('→') || '(yok)'} [${correlationId}]`
    );

    // Tekrarlı işlemi önle
    const dedupKey = `${triggerModule}-${productIds.sort().join(',')}`;
    if (this.processing.has(dedupKey)) {
      console.log(`[WorkflowStateManager] Zaten işleniyor: ${dedupKey}`);
      return { updatedCount: 0, cascadeChain, affectedModules: [], logEntries };
    }
    this.processing.add(dedupKey);

    try {
      let updatedCount = 0;
      let totalChangedFields = 0;

      for (const productId of productIds) {
        // Mevcut WorkflowState'i al veya oluştur
        let ws = await prisma.workflowState.findUnique({ where: { productId } });
        if (!ws) {
          ws = await prisma.workflowState.create({
            data: {
              productId,
              status: 'IMPORTED',
              readiness: 0,
              stepCategory: 'MISSING',
              stepBrand: 'MISSING',
              stepVariant: 'MISSING',
              stepTitle: 'MISSING',
            },
          });
        }

        const oldStatus = ws.status;
        const oldReadiness = ws.readiness;
        const changedFields: string[] = [];
        const affectedModules: ModuleType[] = [triggerModule];

        // 1. Tetikleyen modülü güncelle
        if (triggerModule !== 'READY_TO_SEND') {
          const fieldName = MODULE_FIELD_MAP[triggerModule];
          const stepValue: WorkflowStepStatus = newValue ? 'OK' : 'MISSING';
          
          if ((ws as any)[fieldName] !== stepValue) {
            await prisma.workflowState.update({
              where: { productId },
              data: { [fieldName]: stepValue },
            });
            changedFields.push(fieldName);
            
            logEntries.push({
              productId,
              event: `workflow.${triggerModule.toLowerCase()}.${newValue ? 'completed' : 'reset'}`,
              details: { field: fieldName, oldValue: (ws as any)[fieldName], newValue: stepValue, source },
            });
          }
        }

        // 2. Cascade: Alt modülleri RESETLE
        for (const cascadeModule of cascadeChain) {
          const cascadeField = MODULE_FIELD_MAP[cascadeModule];
          
          if (cascadeModule === 'READY_TO_SEND') {
            // ReadyToSend için status alanını güncelle
            const newStatus = this.calculateNewStatus(ws, triggerModule, newValue);
            if (ws.status !== newStatus) {
              await prisma.workflowState.update({
                where: { productId },
                data: { status: newStatus, readiness: 0 },
              });
              changedFields.push('status');
              affectedModules.push(cascadeModule);
              
              logEntries.push({
                productId,
                event: `workflow.readytosend.updated`,
                details: { oldStatus: ws.status, newStatus, triggerModule },
              });
            }
          } else {
            // Diğer modülleri MISSING yap
            const resetValue: WorkflowStepStatus = 'MISSING';
            const currentValue = (ws as any)[cascadeField];
            
            if (currentValue !== resetValue) {
              await prisma.workflowState.update({
                where: { productId },
                data: { [cascadeField]: resetValue },
              });
              changedFields.push(cascadeField);
              affectedModules.push(cascadeModule);
              
              logEntries.push({
                productId,
                event: `workflow.${cascadeModule.toLowerCase()}.reset`,
                details: { field: cascadeField, oldValue: currentValue, newValue: resetValue, reason: `${triggerModule} changed` },
              });
            }
          }
        }

        // 3. Readiness'i yeniden hesapla
        const newReadiness = await this.recalculateReadiness(productId);
        totalChangedFields += changedFields.length;
        
        // 4. Son durumu al
        const updatedWs = await prisma.workflowState.findUnique({ where: { productId } });
        
        // 5. WorkflowStateChanged event'ini yayınla
        if (changedFields.length > 0 || oldReadiness !== newReadiness) {
          await EventBus.emit({
            type: 'WorkflowStateChanged',
            correlationId,
            timestamp,
            source: `WorkflowStateManager.${triggerModule}`,
            data: {
              productId,
              oldStatus,
              newStatus: updatedWs?.status || oldStatus,
              oldReadiness,
              newReadiness,
              changedFields,
              triggerModule,
              cascadeChain: [triggerModule, ...cascadeChain],
            },
          });
        }

        console.log(
          `[WorkflowStateManager] Urun ${productId}: ` +
          `trigger=${triggerModule}, changedFields=[${changedFields.join(',')}], ` +
          `${oldStatus}→${updatedWs?.status}, readiness:${oldReadiness}→${newReadiness}`
        );

        updatedCount++;
      }

      // 6. DashboardRefresh event'ini yayınla
      await EventBus.emit({
        type: 'DashboardRefresh',
        correlationId,
        timestamp,
        source: 'WorkflowStateManager',
        data: {
          reason: `${triggerModule} changed, cascade: ${cascadeChain.join('→')}`,
          affectedProductIds: productIds,
          affectedModules: [triggerModule, ...cascadeChain],
        },
      });

      console.log(
        `[WorkflowStateManager] Tamam: trigger=${triggerModule}, ` +
        `updated=${updatedCount}, cascade=${cascadeChain.join('→')}, ` +
        `totalChangedFields=${totalChangedFields} [${correlationId}]`
      );

      return {
        updatedCount,
        cascadeChain,
        affectedModules: [triggerModule, ...cascadeChain.filter(m => m !== triggerModule)],
        logEntries,
      };
    } catch (error) {
      console.error(`[WorkflowStateManager] HATA: trigger=${triggerModule}:`, error);
      throw error;
    } finally {
      this.processing.delete(dedupKey);
    }
  }

  // ==================== READINESS HESAPLAMA ====================

  /**
   * Bir ürünün readiness skorunu WorkflowState üzerinden hesaplar.
   * TEK KAYNAK: WorkflowState - Product alanlarını OKUMAZ.
   */
  static async recalculateReadiness(productId: string): Promise<number> {
    const ws = await prisma.workflowState.findUnique({ where: { productId } });
    if (!ws) return 0;

    // WorkflowState alanlarına göre skor hesapla
    const weights: Record<string, number> = {
      stepCategory: 25,
      stepBrand: 25,
      stepVariant: 20,
      stepTitle: 30,
    };

    let score = 0;
    for (const [field, weight] of Object.entries(weights)) {
      if ((ws as any)[field] === 'OK') {
        score += weight;
      }
    }

    // Readiness'i güncelle
    await prisma.workflowState.update({
      where: { productId },
      data: { readiness: score },
    });

    return score;
  }

  /**
   * Cascade sonrası yeni status'u hesaplar.
   */
  private static calculateNewStatus(
    ws: any,
    triggerModule: ModuleType,
    newValue: boolean
  ): string {
    if (!newValue) {
      // Bir modül resetlenmişse, en düşük seviyeye düş
      return 'HAS_ISSUES';
    }

    // Tüm adımlar OK mi?
    const allStepsOk = ['stepCategory', 'stepBrand', 'stepVariant', 'stepTitle']
      .every((field) => {
        if (field === 'stepCategory' && triggerModule === 'CATEGORY') return newValue;
        if (field === 'stepBrand' && (triggerModule === 'CATEGORY' || triggerModule === 'BRAND')) return newValue;
        if (field === 'stepVariant' && ['CATEGORY', 'BRAND', 'VARIANT'].includes(triggerModule)) return newValue;
        if (field === 'stepTitle' && ['CATEGORY', 'BRAND', 'VARIANT', 'TEMPLATE'].includes(triggerModule)) return newValue;
        return (ws as any)[field] === 'OK';
      });

    if (allStepsOk) return 'READY';
    
    // Kaç adım tamam?
    const completedSteps = ['stepCategory', 'stepBrand', 'stepVariant', 'stepTitle']
      .filter((field) => (ws as any)[field] === 'OK').length;
    
    if (completedSteps >= 3) return 'NEEDS_REVIEW';
    if (completedSteps >= 1) return 'HAS_ISSUES';
    return 'CANNOT_SEND';
  }

  // ==================== STATS ====================

  /**
   * WorkflowState istatistiklerini döndürür.
   * Dashboard, Ürün Hazırlama, Gönderime Hazır aynı veriyi gösterir.
   */
  static async getStats() {
    const [total, byStatus, readinessAvg] = await Promise.all([
      prisma.workflowState.count(),
      prisma.workflowState.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.workflowState.aggregate({
        _avg: { readiness: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s.status] = s._count.status;
    }

    // WorkflowState'den eksik bilgiler
    const missingCategory = await prisma.workflowState.count({ where: { stepCategory: 'MISSING' } });
    const missingBrand = await prisma.workflowState.count({ where: { stepBrand: 'MISSING' } });
    const missingVariant = await prisma.workflowState.count({ where: { stepVariant: 'MISSING' } });
    const missingTitle = await prisma.workflowState.count({ where: { stepTitle: 'MISSING' } });

    return {
      total,
      ready: statusMap['READY'] || 0,
      needsReview: statusMap['NEEDS_REVIEW'] || 0,
      hasIssues: statusMap['HAS_ISSUES'] || 0,
      cannotSend: statusMap['CANNOT_SEND'] || 0,
      avgReadiness: Math.round(readinessAvg._avg.readiness || 0),
      errors: {
        missingCategory,
        missingBrand,
        missingVariant,
        missingTitle,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Tek bir ürünün WorkflowState'ini günceller
   * (Product alanlarından WorkflowState'e sync)
   */
  static async syncFromProduct(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        categoryMatch: true,
        brandMatch: true,
        variantMatch: true,
        templateMatch: true,
      },
    });

    if (!product) return;

    await prisma.workflowState.upsert({
      where: { productId },
      update: {
        stepCategory: product.categoryMatch ? 'OK' : 'MISSING',
        stepBrand: product.brandMatch ? 'OK' : 'MISSING',
        stepVariant: product.variantMatch ? 'OK' : 'MISSING',
        stepTitle: product.templateMatch ? 'OK' : 'MISSING',
      },
      create: {
        productId,
        status: 'IMPORTED',
        readiness: 0,
        stepCategory: product.categoryMatch ? 'OK' : 'MISSING',
        stepBrand: product.brandMatch ? 'OK' : 'MISSING',
        stepVariant: product.variantMatch ? 'OK' : 'MISSING',
        stepTitle: product.templateMatch ? 'OK' : 'MISSING',
      },
    });

    // Readiness'i yeniden hesapla
    await this.recalculateReadiness(productId);
  }

  /**
   * Tüm ürünleri WorkflowState ile senkronize et
   */
  static async syncAllFromProducts(): Promise<number> {
    const products = await prisma.product.findMany({
      select: { id: true },
      take: 10000,
    });

    let count = 0;
    for (const p of products) {
      await this.syncFromProduct(p.id);
      count++;
    }

    return count;
  }
}
