import { prisma } from '../../db/prisma.ts';

// Status donusum haritasi: variantStatus -> variantMatch
const VARIANT_STATUS_MAP: Record<string, boolean> = {
  AUTO_ACCEPTED: true,
  AUTO_CREATED: true,
  NO_VARIANT_NEEDED: true,
  VARIANTSIZ_KABUL: true,
  READY: true,
  SENT: true,
  WAITING_AI: false,
  MANUAL_REVIEW: false,
  RE_ANALYZE: false,
  ERROR: false,
  PENDING: false,
  XML: false,
  PASSIVE: false,
};

/**
 * Varyant Status -> variantMatch Boolean donusumu
 */
function statusToBoolean(status: string | null): boolean {
  if (!status) return false;
  return VARIANT_STATUS_MAP[status] ?? false;
}

/**
 * TEK bir urunun varyant alanlarini senkronize eder
 */
export async function syncVariantFields(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, variantStatus: true, variantMatch: true, status: true },
  });
  if (!product) return;

  // Oncelik sirasi: variantStatus > status
  const sourceStatus = product.variantStatus || product.status || 'XML';
  const expectedMatch = statusToBoolean(sourceStatus);

  if (product.variantMatch !== expectedMatch) {
    await prisma.product.update({
      where: { id: productId },
      data: { variantMatch: expectedMatch },
    });
  }
}

/**
 * TUM urunlerin varyant alanlarini senkronize eder
 */
export async function syncAllVariantFields(): Promise<{
  total: number;
  fixed: number;
  errors: number;
}> {
  let fixed = 0;
  let errors = 0;

  const products = await prisma.product.findMany({
    select: { id: true, variantStatus: true, variantMatch: true, status: true },
  });

  for (const product of products) {
    try {
      const sourceStatus = product.variantStatus || product.status || 'XML';
      const expectedMatch = statusToBoolean(sourceStatus);

      if (product.variantMatch !== expectedMatch) {
        await prisma.product.update({
          where: { id: product.id },
          data: { variantMatch: expectedMatch },
        });
        fixed++;
      }
    } catch {
      errors++;
    }
  }

  return { total: products.length, fixed, errors };
}

/**
 * Istatistikleri dondurur - tum ekranlar ayni veriyi gorur
 */
export async function getVariantStats(): Promise<{
  total: number;
  variantMatched: number;
  variantPending: number;
  variantAnalysisPending: number;
  noVariantNeeded: number;
  autoAccepted: number;
  manualReview: number;
}> {
  const [total, variantMatched, variantPending, variantAnalysisPending, autoAccepted, manualReview, noVariantNeeded] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { variantMatch: true } }),
    prisma.product.count({ where: { variantMatch: false } }),
    prisma.product.count({ where: { variantStatus: { in: ['MANUAL_REVIEW', 'WAITING_AI', 'RE_ANALYZE'] } } }),
    prisma.product.count({ where: { variantStatus: 'AUTO_ACCEPTED' } }),
    prisma.product.count({ where: { variantStatus: 'MANUAL_REVIEW' } }),
    prisma.product.count({ where: { variantStatus: { in: ['NO_VARIANT_NEEDED', 'VARIANTSIZ_KABUL'] } } }),
  ]);

  return {
    total,
    variantMatched,
    variantPending,
    variantAnalysisPending,
    autoAccepted,
    manualReview,
    noVariantNeeded,
  };
}
