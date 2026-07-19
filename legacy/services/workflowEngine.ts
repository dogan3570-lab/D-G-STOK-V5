import { prisma } from '../db/prisma.ts';

const SCORE_CONFIG = {
  stepCategory: 20, stepBrand: 20, stepVariant: 10,
  stepTitle: 10, stepSeo: 10, stepPrice: 5, stepImage: 5,
  stepBarcode: 5, stepStock: 5,
};

export async function calculateReadiness(product: any): Promise<{ score: number; steps: Record<string, string> }> {
  const steps: Record<string, string> = {};

  steps.stepCategory = product.categoryMatch ? 'OK' : 'MISSING';
  steps.stepBrand = product.brandMatch ? 'OK' : 'MISSING';
  steps.stepVariant = product.variantMatch ? 'OK' : 'MISSING';
  steps.stepTitle = product.computedTitle ? 'OK' : 'MISSING';
  steps.stepSeo = (product.seoTitle || product.seoDescription) ? 'OK' : 'MISSING';
  steps.stepPrice = (product.salePrice && product.salePrice > 0) ? 'OK' : 'MISSING';
  steps.stepImage = product.images ? 'OK' : 'MISSING';
  steps.stepBarcode = product.barcode ? 'OK' : 'MISSING';
  steps.stepStock = (product.stock && product.stock > 0) ? 'OK' : 'MISSING';

  let score = 0;
  for (const [key, max] of Object.entries(SCORE_CONFIG)) {
    if (steps[key] === 'OK') score += max;
  }

  return { score, steps };
}

export function getReadinessColor(score: number): string {
  if (score >= 100) return 'bg-green-500 text-white';
  if (score >= 90) return 'bg-green-400 text-white';
  if (score >= 80) return 'bg-yellow-400 text-black';
  if (score >= 60) return 'bg-orange-400 text-white';
  if (score >= 40) return 'bg-red-400 text-white';
  return 'bg-red-700 text-white';
}

export function getStatusFromScore(score: number): string {
  if (score >= 100) return 'READY';
  if (score >= 80) return 'NEEDS_REVIEW';
  if (score >= 60) return 'HAS_ISSUES';
  return 'CANNOT_SEND';
}

export async function refreshWorkflowForProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const { score, steps } = await calculateReadiness(product);
  const status = getStatusFromScore(score);

  await prisma.workflowState.upsert({
    where: { productId },
    update: { status, readiness: score, ...steps, errorCount: Object.values(steps).filter(s => s === 'MISSING').length },
    create: { productId, status, readiness: score, ...steps },
  });
}

export async function seedWorkflowStates(): Promise<number> {
  const products = await prisma.product.findMany({ take: 10000 });
  let count = 0;
  for (const p of products) {
    await refreshWorkflowForProduct(p.id);
    count++;
  }
  return count;
}
