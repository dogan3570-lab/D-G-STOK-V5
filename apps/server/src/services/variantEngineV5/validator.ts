// ==================== DOĞRULAYICI V5.0 ====================
// DG STOK V5.0 - Karar doğrulama kuralları
// ===========================================================

import type { V5Product, VariantDecision, CategoryVariantConfig } from './types.ts';
import type { IValidator } from './interfaces.ts';
import { THRESHOLDS } from './constants.ts';

export class Validator implements IValidator {
  async validate(decision: VariantDecision, product: V5Product): Promise<boolean> {
    // MANUAL_REVIEW ve ERROR kararları zaten geçersiz
    if (decision.status === 'MANUAL_REVIEW' || decision.status === 'ERROR') {
      return false;
    }

    const checks: string[] = [];

    // 1. Güven skoru kontrolü
    if (decision.confidence < THRESHOLDS.MANUAL_REVIEW_CONFIDENCE) {
      checks.push('Güven skoru çok düşük');
    }

    // 2. Varyant tutarlılığı
    if (decision.extractedVariants.length > 0) {
      const uniqueTypes = new Set(decision.extractedVariants.map(v => v.type));
      if (uniqueTypes.size < decision.extractedVariants.length) {
        checks.push('Aynı tipte birden fazla varyant değeri var');
      }
    }

    // KURAL 1-2: NO_VARIANT_REQUIRED kararlarına karışma
    // Eğer decisionEngine emin olarak NO_VARIANT_REQUIRED verdiyse buna güven
    // (confidence >= 95 olan NO_VARIANT_REQUIRED kararları geçerlidir)
    if (decision.status === 'NO_VARIANT_REQUIRED' && decision.confidence >= 95) {
      // Güvenli NO_VARIANT_REQUIRED - geçerli kabul et
      return checks.length === 0;
    }

    // 4. AUTO_CREATED ise varyantların kaydedildiğini kontrol et
    if (decision.status === 'AUTO_CREATED' && decision.extractedVariants.length === 0) {
      checks.push('AUTO_CREATED ama hiç varyant çıkarılmamış');
    }

    decision.warnings.push(...checks);
    return checks.length === 0;
  }

  async validateBatch(decisions: VariantDecision[], products: Map<string, V5Product>): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const decision of decisions) {
      const product = products.get(decision.productId);
      if (!product) {
        results.set(decision.productId, false);
        continue;
      }
      const isValid = await this.validate(decision, product);
      results.set(decision.productId, isValid);
    }

    return results;
  }
}

export const validator = new Validator();
