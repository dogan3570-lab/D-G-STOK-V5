// ==================== AUTO RECALCULATION ENGINE V1.0 ====================
// DG STOK V5.0 - Merkezi Otomatik Yeniden Hesaplama Motoru
//
// KURAL: Sistemde hicbir kullanici manuel "Refresh" yapmak zorunda kalmaz.
// Her degisiklik sonrasi ilgili moduller otomatik olarak yeniden hesaplanir.
//
// AKIS:
// 1. Category Engine   -> categoryMatch
// 2. Brand Engine      -> brandMatch
// 3. Variant Engine    -> variantMatch
// 4. Template Engine   -> templateMatch
// 5. Price Engine      -> salePrice kontrol
// 6. Barcode Engine    -> barcode kontrol
// 7. Image Engine      -> images kontrol
// 8. Description Engine-> description kontrol
// 9. Workflow Engine   -> workflowState
// 10. ReadyToSend Engine-> product.status (READY|PASSIVE|ERROR)
// 11. Summary Engine   -> cache temizle
// 12. Dashboard        -> cache temizle
// 13. Kontrol Merkezi  -> cache temizle
// 14. Urun Havuzu      -> (UI yenilenir)
// 15. Marketplace Queue-> stockProtection tetiklenir
// =====================================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';

import { TemplateEngine } from './engines/TemplateEngine.ts';
import { PriceEngine } from './engines/PriceEngine.ts';
import { BarcodeEngine } from './engines/BarcodeEngine.ts';
import { ImageEngine } from './engines/ImageEngine.ts';
import { DescriptionEngine } from './engines/DescriptionEngine.ts';
import { ReadyToSendEngine } from './engines/ReadyToSendEngine.ts';
import { SummaryService } from './SummaryService.ts';
import { syncVariantFields } from '../variant/VariantConsistencyService.ts';
import { WorkflowStateManager } from '../workflow/WorkflowStateManager.ts';
import { DashboardService } from '../dashboard/DashboardService.ts';

export interface RecalculationLog {
  productId: string;
  trigger: string;
  steps: Array<{ name: string; durationMs: number; changed: boolean }>;
  totalDurationMs: number;
  timestamp: string;
}

export class AutoRecalculationEngine {
  private static log: RecalculationLog[] = [];
  private static maxLogSize = 1000;
  private static processing = new Set<string>(); // Tekrari onle

  /**
   * Ana giris noktasi.
   * Bir urun degistiginde bu metod cagrilir.
   * Tetikleyici: XML Import, Kategori, Marka, Varyant, Template, Fiyat, Stok vb.
   */
  static async onProductChanged(productId: string, trigger: string): Promise<RecalculationLog> {
    // Tekrar islemi onle (race condition)
    if (this.processing.has(productId)) {
      console.log(`[AutoRecalc] Zaten isleniyor: ${productId}`);
      return null as any;
    }

    this.processing.add(productId);
    const startTime = Date.now();
    const steps: Array<{ name: string; durationMs: number; changed: boolean }> = [];

    try {
      const correlationId = createCorrelationId('BATCH');

      console.log(`[AutoRecalc] Basladi: ${productId} (trigger: ${trigger}) [${correlationId}]`);

      // === STEP 4: Template Engine ===
      let s = Date.now();
      const templateResult = await TemplateEngine.recalculate(productId);
      steps.push({ name: 'Template', durationMs: Date.now() - s, changed: templateResult.changed });

      // === STEP 5: Price Engine ===
      s = Date.now();
      const priceResult = await PriceEngine.recalculate(productId);
      steps.push({ name: 'Price', durationMs: Date.now() - s, changed: priceResult.changed });

      // === STEP 6: Barcode Engine ===
      s = Date.now();
      const barcodeResult = await BarcodeEngine.recalculate(productId);
      steps.push({ name: 'Barcode', durationMs: Date.now() - s, changed: barcodeResult.changed });

      // === STEP 7: Image Engine ===
      s = Date.now();
      const imageResult = await ImageEngine.recalculate(productId);
      steps.push({ name: 'Image', durationMs: Date.now() - s, changed: imageResult.changed });

      // === STEP 8: Description Engine ===
      s = Date.now();
      const descResult = await DescriptionEngine.recalculate(productId);
      steps.push({ name: 'Description', durationMs: Date.now() - s, changed: descResult.changed });

      // === STEP 3: Variant Consistency (Variant Engine sonrasi) ===
      s = Date.now();
      await syncVariantFields(productId);
      steps.push({ name: 'Variant', durationMs: Date.now() - s, changed: true });

      // === STEP 9: Workflow Engine ===
      s = Date.now();
      await WorkflowStateManager.syncFromProduct(productId);
      steps.push({ name: 'Workflow', durationMs: Date.now() - s, changed: true });

      // === STEP 10: ReadyToSend Engine ===
      s = Date.now();
      const readinessResult = await ReadyToSendEngine.recalculate(productId);
      steps.push({ name: 'ReadyToSend', durationMs: Date.now() - s, changed: true });

      // === STEP 11: Summary Cache Temizle ===
      s = Date.now();
      SummaryService.clearCache();
      DashboardService.clearCache();
      steps.push({ name: 'Summary', durationMs: Date.now() - s, changed: true });

      const totalDurationMs = Date.now() - startTime;

      // Log kaydi
      const logEntry: RecalculationLog = {
        productId,
        trigger,
        steps,
        totalDurationMs,
        timestamp: new Date().toISOString(),
      };

      this.log.push(logEntry);
      if (this.log.length > this.maxLogSize) this.log.shift();

      console.log(
        `[AutoRecalc] Tamam: ${productId} | ` +
        `${readinessResult.isReady ? '✅ HAZIR' : '⏳ HAZIR DEGIL'} ` +
        `(skor:${readinessResult.score}/100) | ` +
        `${totalDurationMs}ms [${correlationId}]`
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: `auto_recalculation.${trigger}`,
          entity: 'Product',
          entityId: productId,
          details: JSON.stringify({ steps, totalDurationMs, readiness: readinessResult.score }),
          success: true,
        },
      });

      return logEntry;
    } catch (error) {
      const totalDurationMs = Date.now() - startTime;
      console.error(`[AutoRecalc] HATA: ${productId}:`, error);

      await prisma.auditLog.create({
        data: {
          action: `auto_recalculation.${trigger}`,
          entity: 'Product',
          entityId: productId,
          details: `Hata: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
        },
      });

      return { productId, trigger, steps, totalDurationMs, timestamp: new Date().toISOString() };
    } finally {
      this.processing.delete(productId);
    }
  }

  /**
   * Son loglari dondurur
   */
  static getLogs(limit = 50): RecalculationLog[] {
    return this.log.slice(-limit);
  }
}
