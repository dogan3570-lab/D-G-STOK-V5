// ==================== VARYANT MOTORU V5.0 - PUBLIC API ====================
// DG STOK V5.0 - Category-Based Smart Variant Engine
// Ana giriş noktası. Tüm dış çağrılar bu dosya üzerinden yapılır.
// ==========================================================================

import type { V5Product, VariantDecision, PipelineResult, CategoryVariantConfig } from './types.ts';
import { pipeline } from './pipeline.ts';
import { decisionEngine } from './decisionEngine.ts';
import { categoryEngine } from './categoryEngine.ts';
import { aiExtractor } from './aiExtractor.ts';
import { familyEngine } from './familyEngine.ts';
import { validator } from './validator.ts';
import { logger } from './logger.ts';
import { cache } from './cache.ts';
import { toV5Product } from './helpers.ts';

// ==================== PIPELINE ====================

export async function runV5Pipeline(xmlSourceId?: string): Promise<PipelineResult> {
  return pipeline.run(xmlSourceId);
}

export async function resumeV5Pipeline(stateId: string): Promise<PipelineResult> {
  return pipeline.resume(stateId);
}

// ==================== TEK ÜRÜN KARARI ====================

export async function decideProduct(prismaProduct: any): Promise<VariantDecision> {
  const product = toV5Product(prismaProduct);
  const config = product.categoryId
    ? await categoryEngine.getCategoryConfig(product.categoryId)
    : null;
  return decisionEngine.decide(product, config);
}

export async function decideProductById(productId: string): Promise<VariantDecision | null> {
  try {
    const { prisma } = await import('../../db/prisma.ts');
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        xmlSource: { select: { id: true, name: true } },
        variants: { select: { id: true, name: true, value: true } },
      },
    });
    if (!product) return null;
    return decideProduct(product);
  } catch {
    return null;
  }
}

// ==================== KATEGORİ YÖNETİMİ ====================

export async function getCategoryConfig(categoryId: string): Promise<CategoryVariantConfig | null> {
  return categoryEngine.getCategoryConfig(categoryId);
}

export async function updateCategoryVariantConfig(
  categoryId: string,
  config: Partial<CategoryVariantConfig>
): Promise<void> {
  return categoryEngine.updateCategoryConfig(categoryId, config);
}

export function clearCategoryCache(): void {
  categoryEngine.clearCache();
}

// ==================== AI ÇIKARIM ====================

export async function extractVariantsFromProduct(product: V5Product) {
  const config = product.categoryId
    ? await categoryEngine.getCategoryConfig(product.categoryId)
    : null;
  return aiExtractor.analyzeProduct(product, config);
}

// ==================== LOG ====================

export async function getDecisionHistory(productId: string, limit = 10) {
  return logger.getDecisionHistory(productId, limit);
}

// ==================== DURUM BİLGİSİ ====================

export function getCacheSize(): number {
  return cache.size;
}

// ==================== TİP DİŞA AKTARIMLARI ====================

export type {
  V5Product,
  VariantDecision,
  PipelineResult,
  CategoryVariantConfig,
} from './types.ts';
