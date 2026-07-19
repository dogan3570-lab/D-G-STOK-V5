// ==================== KARAR LOG SISTEMI ====================
// DG STOK V5.0 - XML Motoru V2
// Her karar loglanir. Kullanici tahmin yurutmez.
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type { DecisionLog } from './types.ts';

/**
 * Bir karari loglar
 */
export async function logDecision(d: DecisionLog): Promise<void> {
  try {
    await prisma.transformationLog.create({
      data: {
        productId: d.productId,
        action: d.action,
        stepType: d.module,
        details: JSON.stringify({
          reason: d.reason,
          confidence: d.confidence,
          oldValue: d.oldValue,
          newValue: d.newValue,
          autoApplied: d.autoApplied,
          actorUserId: d.actorUserId,
        }),
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`[DecisionLogger] Log error for product ${d.productId}:`, error);
  }
}

/**
 * Varyant kararini loglar
 */
export async function logVariantDecision(
  productId: string,
  decision: string,
  reason: string,
  confidence: number,
  autoApplied: boolean
): Promise<void> {
  await logDecision({
    productId,
    module: 'VARIANT',
    action: `VARIANT_${decision}`,
    reason,
    confidence,
    autoApplied,
    createdAt: new Date(),
  });
}

/**
 * Kalite puani kararini loglar
 */
export async function logQualityDecision(
  productId: string,
  score: number,
  issues: string[]
): Promise<void> {
  await logDecision({
    productId,
    module: 'QUALITY',
    action: 'QUALITY_SCORE',
    reason: `Guven skoru: ${score}/100. Sorunlar: ${issues.join(', ')}`,
    confidence: score,
    autoApplied: score >= 70,
    createdAt: new Date(),
  });
}
