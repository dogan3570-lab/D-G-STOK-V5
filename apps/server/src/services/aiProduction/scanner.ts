// ==================== AI PRODUCTION CENTER - SCANNER ====================
// DG STOK V5.0 - Ana tarama motoru
// Her ürünü analiz eder, AICheck tablosuna yazar
// ======================================================================

import { prisma } from '../../db/prisma.ts';

const WEIGHTS: Record<string, number> = {
  category: 15, brand: 15, variant: 15, title: 10,
  seo: 10, description: 10, image: 10, price: 10,
  barcode: 5, template: 5, stock: 5,
};

const STATUS_ORDER = ['OK', 'WARNING', 'ERROR', 'PENDING'] as const;
type CheckStatus = (typeof STATUS_ORDER)[number];

function getStatus(value: boolean | number | null | undefined, threshold?: number): CheckStatus {
  if (value === true || (typeof value === 'number' && value > 0)) return 'OK';
  if (value === false || (typeof value === 'number' && value === 0)) return 'ERROR';
  return 'PENDING';
}

export async function scanProduct(productId: string) {
  const [product, ws, templateCount] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true, category: true, brand: true },
    }),
    prisma.workflowState.findUnique({ where: { productId } }),
    prisma.listingTemplate.count({ where: { productId } }),
  ]);

  if (!product) return null;

  const checks = {
    category: getStatus(ws?.stepCategory === 'OK'),
    brand: getStatus(ws?.stepBrand === 'OK'),
    variant: getStatus((product.variants?.length ?? 0) > 0),
    barcode: getStatus(product.barcode),
    image: getStatus(product.images, 1),
    title: getStatus(product.title, 1),
    description: getStatus(product.description && product.description.length > 50),
    seo: getStatus(product.seoTitle || product.seoDescription),
    price: getStatus(product.salePrice && product.salePrice > 0),
    stock: getStatus(product.stock && product.stock > 0),
    template: getStatus(templateCount > 0),
    workflow: getStatus(ws?.status === 'READY'),
  };

  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    if (checks[key as keyof typeof checks] === 'OK') score += weight;
  }

  const okCount = Object.values(checks).filter(v => v === 'OK').length;
  let overallStatus: string;
  if (score >= 100) overallStatus = 'PERFECT';
  else if (score >= 80) overallStatus = 'GOOD';
  else if (score >= 60) overallStatus = 'WARNING';
  else overallStatus = 'ERROR';

  await prisma.aICheck.upsert({
    where: { productId },
    update: {
      categoryStatus: checks.category, brandStatus: checks.brand,
      variantStatus: checks.variant, barcodeStatus: checks.barcode,
      imageStatus: checks.image, titleStatus: checks.title,
      descriptionStatus: checks.description, seoStatus: checks.seo,
      priceStatus: checks.price, stockStatus: checks.stock,
      listingTemplateStatus: checks.template, workflowStatus: checks.workflow,
      overallScore: score, overallStatus,
    },
    create: {
      productId,
      categoryStatus: checks.category, brandStatus: checks.brand,
      variantStatus: checks.variant, barcodeStatus: checks.barcode,
      imageStatus: checks.image, titleStatus: checks.title,
      descriptionStatus: checks.description, seoStatus: checks.seo,
      priceStatus: checks.price, stockStatus: checks.stock,
      listingTemplateStatus: checks.template, workflowStatus: checks.workflow,
      overallScore: score, overallStatus,
    },
  });

  return { productId, score, overallStatus, okCount, totalChecks: Object.keys(checks).length };
}

export async function scanAllProducts(
  onProgress?: (done: number, total: number) => void
): Promise<{ total: number; processed: number; averageScore: number }> {
  const products = await prisma.product.findMany({ select: { id: true } });
  const total = products.length;
  let totalScore = 0;

  for (let i = 0; i < products.length; i++) {
    await scanProduct(products[i].id);
    totalScore += (await prisma.aICheck.findUnique({ where: { productId: products[i].id } }))?.overallScore ?? 0;
    if (onProgress) onProgress(i + 1, total);
  }

  return { total, processed: products.length, averageScore: total > 0 ? Math.round(totalScore / total) : 0 };
}

export async function getDashboard() {
  const [checks, total] = await Promise.all([
    prisma.aICheck.groupBy({ by: ['overallStatus'], _count: { overallStatus: true }, _avg: { overallScore: true } }),
    prisma.aICheck.count(),
  ]);

  const result: Record<string, number> = { perfect: 0, good: 0, warning: 0, error: 0 };
  let avgScore = 0;

  for (const c of checks) {
    const key = c.overallStatus.toLowerCase() as keyof typeof result;
    if (key in result) result[key] = c._count.overallStatus;
    avgScore += (c._avg.overallScore ?? 0) * c._count.overallStatus;
  }

  return {
    totalProducts: total,
    ...result,
    averageScore: total > 0 ? Math.round(avgScore / total) : 0,
    lastScan: new Date().toISOString(),
  };
}
