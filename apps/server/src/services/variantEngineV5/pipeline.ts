// ==================== PIPELINE V5.0 ====================
// DG STOK V5.0 - Pipeline orchestrator (batch/queue/worker)
// ========================================================

import { prisma } from '../../db/prisma.ts';
import type { V5Product, VariantDecision, PipelineResult, PipelineState } from './types.ts';
import type { IPipeline } from './interfaces.ts';
import { decisionEngine } from './decisionEngine.ts';
import { familyEngine } from './familyEngine.ts';
import { validator } from './validator.ts';
import { logger } from './logger.ts';
import { categoryEngine } from './categoryEngine.ts';
import { toV5Product, sleep } from './helpers.ts';
import { DEFAULT_PIPELINE_CONFIG } from './constants.ts';
import { syncVariantFields } from '../variant/VariantConsistencyService.ts';
import { WorkflowStateManager } from '../workflow/WorkflowStateManager.ts';

export class Pipeline implements IPipeline {
  private config = DEFAULT_PIPELINE_CONFIG;
  private state: PipelineState | null = null;

  async run(xmlSourceId?: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const decisions: VariantDecision[] = [];
    const stats = {
      autoApproved: 0,
      autoCreated: 0,
      waitingAI: 0,
      waitingUser: 0,
      manualReview: 0,
      error: 0,
      skipped: 0,
      noVariantRequired: 0,
    };

    // Pipeline state oluştur
    this.state = {
      id: `v5_${Date.now()}`,
      xmlSourceId: xmlSourceId ?? null,
      status: 'RUNNING',
      processedCount: 0,
      totalCount: 0,
      currentCursor: null,
      errors: [],
      startedAt: new Date(),
      completedAt: null,
    };

    try {
      // Toplam ürün sayısını al
      const where: any = {};
      if (xmlSourceId) where.xmlSourceId = xmlSourceId;
      this.state.totalCount = await prisma.product.count({ where });

      // Batch ile ürünleri işle
      let hasMore = true;
      let cursor: string | null = null;

      while (hasMore) {
        const pageWhere: any = { ...where };
        if (cursor) pageWhere.id = { gt: cursor };

        const products = await prisma.product.findMany({
          where: pageWhere,
          orderBy: { id: 'asc' },
          take: this.config.batchSize,
          include: {
            brand: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            xmlSource: { select: { id: true, name: true } },
            variants: { select: { id: true, name: true, value: true } },
          },
        });

        if (products.length === 0) break;
        cursor = products[products.length - 1].id;
        hasMore = products.length === this.config.batchSize;

        // Ürünleri V5 formatına çevir
        const v5Products = products.map(p => toV5Product(p));
        const productMap = new Map<string, V5Product>(v5Products.map(p => [p.id, p]));

        // Karar motorunu çalıştır
        const batchDecisions = await decisionEngine.decideBatch(v5Products);

        // Doğrula
        const validationResults = await validator.validateBatch(batchDecisions, productMap);

        // Geçersiz kararları MANUAL_REVIEW yap
        for (const decision of batchDecisions) {
          if (!validationResults.get(decision.productId)) {
            decision.status = 'MANUAL_REVIEW';
            decision.reason = 'Doğrulama başarısız: ' + decision.reason;
          }
        }

        // Ürün ailelerini bul
        const families = await familyEngine.findFamilies(v5Products, new Map(batchDecisions.map(d => [d.productId, d])));

        // Aile bilgisini kararlara ekle
        for (const [, family] of families) {
          for (const member of family.products) {
            const decision = batchDecisions.find(d => d.productId === member.productId);
            if (decision) {
              decision.familyId = family.id;
            }
          }
        }

        // KURAL 5-6: product.variantStatus güncelle + WorkflowState güncelle
        for (const decision of batchDecisions) {
          try {
            await prisma.product.update({
              where: { id: decision.productId },
              data: { variantStatus: decision.status },
            });
            // variantMatch alanını senkronize et
            await syncVariantFields(decision.productId);
            // KURAL 6: WorkflowState otomatik güncelle
            await WorkflowStateManager.syncFromProduct(decision.productId);
          } catch { /* ignore */ }
        }

        // Logla
        await logger.logBatch(batchDecisions, productMap);

        // İstatistikleri güncelle
        for (const d of batchDecisions) {
          switch (d.status) {
            case 'AUTO_APPROVED': stats.autoApproved++; break;
            case 'AUTO_CREATED': stats.autoCreated++; break;
            case 'WAITING_AI': stats.waitingAI++; break;
            case 'WAITING_USER': stats.waitingUser++; break;
            case 'MANUAL_REVIEW': stats.manualReview++; break;
            case 'ERROR': stats.error++; break;
            case 'SKIPPED': stats.skipped++; break;
            case 'NO_VARIANT_REQUIRED': stats.noVariantRequired++; break;
          }
        }

        decisions.push(...batchDecisions);
        this.state.processedCount += products.length;
        this.state.currentCursor = cursor;

        // Checkpoint - her batch sonunda kaydet
        console.log(`[V5] İlerleme: ${this.state.processedCount}/${this.state.totalCount} ürün (${Math.round(this.state.processedCount / this.state.totalCount * 100)}%)`);

        // Hız için bekleme yok - 100.000+ ürün desteği
      }

      this.state.status = 'COMPLETED';
      this.state.completedAt = new Date();

    } catch (error) {
      this.state.status = 'FAILED';
      this.state.errors.push(String(error));
      console.error('[V5] Pipeline hatası:', error);
    }

    const duration = Date.now() - startTime;

    return {
      processedCount: this.state.processedCount,
      decisions,
      stats,
      duration,
    };
  }

  async resume(stateId: string): Promise<PipelineResult> {
    // TODO: Checkpoint'ten devam et
    console.log(`[V5] Resume not yet implemented for state: ${stateId}`);
    return this.run();
  }

  async getState(stateId: string): Promise<PipelineState | null> {
    return this.state?.id === stateId ? this.state : null;
  }

  async cancel(stateId: string): Promise<void> {
    if (this.state?.id === stateId) {
      this.state.status = 'FAILED';
      console.log(`[V5] Pipeline cancelled: ${stateId}`);
    }
  }
}

export const pipeline = new Pipeline();
