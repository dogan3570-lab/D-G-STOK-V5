// ==================== PAZARYERINE GONDERME MOTORU V1.0 ====================
// DG STOK V5.0
// Bu modul sadece gonderim yapar.
// Fiyat/kategori/marka/sablon/barkod/SKU degistirmez.
// Queue tabanli, sirali, izlenebilir gonderim.
// =====================================================================

import { prisma } from '../db/prisma.ts';
import { SummaryService } from './autoRecalculation/SummaryService.ts';

export interface PublishResult {
  productId: string;
  title: string | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  issues: string[];
  error?: string;
  durationMs: number;
}

export interface PublishProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
  skipped: number;
  currentIndex: number;
  results: PublishResult[];
  done: boolean;
}

// Her bir product icin gonderim oncesi kontrol
async function preflightCheck(productId: string): Promise<string[]> {
  const issues: string[] = [];
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      categoryMatch: true, brandMatch: true, variantMatch: true, templateMatch: true,
      barcode: true, sku: true, salePrice: true, stock: true, images: true, description: true, title: true,
    },
  });
  if (!product) { issues.push('Ürün bulunamadı'); return issues; }
  if (!product.categoryMatch) issues.push('Kategori eşleşmemiş');
  if (!product.brandMatch) issues.push('Marka eşleşmemiş');
  if (!product.variantMatch) issues.push('Varyant eşleşmemiş');
  if (!product.templateMatch) issues.push('Şablon atanmamış');
  if (!product.barcode) issues.push('Barkod eksik');
  if (!product.sku) issues.push('SKU eksik');
  if (!product.salePrice || product.salePrice <= 0) issues.push('Satış fiyatı eksik');
  if (!product.stock || product.stock <= 0) issues.push('Stok yok');
  if (!product.images) issues.push('Görsel eksik');
  if (!product.description) issues.push('Açıklama eksik');
  if (!product.title || product.title.length < 3) issues.push('Başlık eksik/geçersiz');
  return issues;
}

// Queue ile sirali gonderim
export async function publishProducts(
  productIds: string[],
  options: { batchSize?: number; actorUserId?: string | null } = {}
): Promise<PublishProgress> {
  const batchSize = options.batchSize || 50;
  const progress: PublishProgress = {
    total: productIds.length,
    completed: 0, success: 0, failed: 0, skipped: 0,
    currentIndex: 0, results: [], done: false,
  };

  const batches: string[][] = [];
  for (let i = 0; i < productIds.length; i += batchSize) {
    batches.push(productIds.slice(i, i + batchSize));
  }

  console.log(`[PublishingEngine] Basladi: ${productIds.length} urun, ${batches.length} batch`);

  for (const batch of batches) {
    for (const productId of batch) {
      const start = Date.now();
      progress.currentIndex++;

      // Pre-flight check
      const issues = await preflightCheck(productId);
      if (issues.length > 0) {
        // Bloke - gonderilemez
        progress.results.push({
          productId, title: null, status: 'SKIPPED', issues,
          durationMs: Date.now() - start,
        });
        progress.skipped++;
        progress.completed++;
        continue;
      }

      try {
        // Status guncelle (gercek API cagrisi burada olacak)
        await prisma.product.update({
          where: { id: productId },
          data: { status: 'PUBLISHED', updatedAt: new Date() },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            action: 'product.publish.success',
            entity: 'Product',
            entityId: productId,
            actorUserId: options.actorUserId,
            details: JSON.stringify({ durationMs: Date.now() - start }),
            success: true,
          },
        });

        progress.results.push({
          productId, title: null, status: 'SUCCESS', issues: [],
          durationMs: Date.now() - start,
        });
        progress.success++;
      } catch (err: any) {
        // Hata
        await prisma.auditLog.create({
          data: {
            action: 'product.publish.failed',
            entity: 'Product',
            entityId: productId,
            actorUserId: options.actorUserId,
            details: JSON.stringify({ error: err.message }),
            success: false,
          },
        });

        progress.results.push({
          productId, title: null, status: 'FAILED', issues: [],
          error: err.message, durationMs: Date.now() - start,
        });
        progress.failed++;
      }

      progress.completed++;
    }

    // Her batch sonrasi SummaryService cache temizle
    SummaryService.clearCache();
  }

  progress.done = true;
  console.log(`[PublishingEngine] Tamam: ${progress.success} basarili, ${progress.failed} basarisiz, ${progress.skipped} atlandi`);
  return progress;
}
