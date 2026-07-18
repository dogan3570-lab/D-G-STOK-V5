// ==================== KARAR LOGLAYICI V5.0 ====================
// DG STOK V5.0 - Her kararı loglar (Madde 13)
// =============================================================

import { prisma } from '../../db/prisma.ts';
import type { VariantDecision, V5Product, DecisionLog } from './types.ts';
import type { ILogger } from './interfaces.ts';

export class Logger implements ILogger {
  async logDecision(decision: VariantDecision, product: V5Product): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: `variant.v5.${decision.status.toLowerCase()}`,
          entity: 'product',
          entityId: product.id,
          actorUserId: null,
          details: JSON.stringify({
            decision: decision.status,
            confidence: decision.confidence,
            source: decision.source,
            reason: decision.reason,
            variantCount: decision.extractedVariants.length,
            categoryConfig: decision.categoryConfig
              ? {
                  categoryName: decision.categoryConfig.categoryName,
                  variantRequired: decision.categoryConfig.variantRequired,
                }
              : null,
            extractedVariants: decision.extractedVariants.map(v => ({
              type: v.type,
              value: v.value,
              confidence: v.confidence,
              source: v.source,
            })),
            errors: decision.errors,
            warnings: decision.warnings,
          }),
          createdAt: new Date(decision.timestamp),
        },
      });
    } catch { /* ignore log errors */ }
  }

  async logBatch(decisions: VariantDecision[], products: Map<string, V5Product>): Promise<void> {
    const logs = decisions.map(decision => {
      const product = products.get(decision.productId);
      return {
        action: `variant.v5.${decision.status.toLowerCase()}`,
        entity: 'product' as const,
        entityId: decision.productId,
        actorUserId: null,
        details: JSON.stringify({
          decision: decision.status,
          confidence: decision.confidence,
          source: decision.source,
          reason: decision.reason,
          productTitle: product?.title || null,
          variantCount: decision.extractedVariants.length,
        }),
        createdAt: new Date(decision.timestamp),
      };
    });

    try {
      // Batch insert - SQLite uyumlu
      for (const log of logs) {
        await prisma.auditLog.create({ data: log }).catch(() => {});
      }
    } catch { /* ignore log errors */ }
  }

  async getDecisionHistory(productId: string, limit = 10): Promise<VariantDecision[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          entity: 'product',
          entityId: productId,
          action: { startsWith: 'variant.v5.' },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return logs.map(log => {
        const details = JSON.parse(log.details || '{}');
        return {
          productId: log.entityId,
          status: details.decision || 'ERROR',
          confidence: details.confidence || 0,
          source: details.source || 'MANUAL',
          reason: details.reason || 'Bilinmiyor',
          extractedVariants: details.extractedVariants || [],
          familyId: null,
          errors: details.errors || [],
          warnings: details.warnings || [],
          categoryConfig: null,
          timestamp: log.createdAt.toISOString(),
        } as VariantDecision;
      });
    } catch {
      return [];
    }
  }
}

export const logger = new Logger();
