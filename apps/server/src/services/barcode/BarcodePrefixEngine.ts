import { prisma } from '../../db/prisma.ts';

interface PrefixRule {
  id: string;
  prefix: string;
  marketplaceKey: string;
  description: string;
  isActive: boolean;
}

export class BarcodePrefixEngine {
  async createRule(prefix: string, marketplaceKey: string, description: string): Promise<PrefixRule> {
    // Collision kontrolu
    const existing = await prisma.setting.findUnique({ where: { key: `barcode_prefix_${marketplaceKey}` } });
    if (existing) {
      throw new Error(`Bu pazaryeri icin barkod prefixi zaten var: ${marketplaceKey}`);
    }

    await prisma.setting.create({
      data: {
        key: `barcode_prefix_${marketplaceKey}`,
        value: JSON.stringify({ prefix, marketplaceKey, description, isActive: true }),
      },
    });

    return { id: `prefix_${marketplaceKey}`, prefix, marketplaceKey, description, isActive: true };
  }

  async getRule(marketplaceKey: string): Promise<PrefixRule | null> {
    const setting = await prisma.setting.findUnique({ where: { key: `barcode_prefix_${marketplaceKey}` } });
    if (!setting) return null;
    const data = JSON.parse(setting.value);
    return { id: `prefix_${marketplaceKey}`, ...data };
  }

  async applyPrefix(originalBarcode: string, marketplaceKey: string): Promise<string> {
    const rule = await this.getRule(marketplaceKey);
    if (!rule || !rule.isActive) return originalBarcode;

    const prefixed = `${rule.prefix}${originalBarcode}`;

    // Collision kontrolu - ayni prefixed barcode daha once kullanilmis mi?
    const existing = await prisma.product.findFirst({ where: { barcode: prefixed } });
    if (existing) {
      throw new Error(`Barkod collision: ${prefixed} zaten kullaniliyor`);
    }

    return prefixed;
  }

  async bulkApply(productIds: string[], marketplaceKey: string): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0, failed = 0;
    const errors: string[] = [];

    for (const productId of productIds) {
      try {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { barcode: true } });
        if (!product || !product.barcode) {
          failed++;
          continue;
        }

        const newBarcode = await this.applyPrefix(product.barcode, marketplaceKey);
        
        // Orijinal barkodu TransformationLog'a kaydet
        await prisma.transformationLog.create({
          data: {
            productId,
            action: 'BARCODE_PREFIX',
            stepType: 'BARCODE',
            details: JSON.stringify({ oldBarcode: product.barcode, newBarcode, marketplaceKey }),
          },
        });

        await prisma.product.update({
          where: { id: productId },
          data: { barcode: newBarcode },
        });

        success++;
      } catch (error: any) {
        failed++;
        errors.push(`${productId}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async rollback(productIds: string[]): Promise<number> {
    let count = 0;
    for (const productId of productIds) {
      const log = await prisma.transformationLog.findFirst({
        where: { productId, action: 'BARCODE_PREFIX' },
        orderBy: { createdAt: 'desc' },
      });
      if (log) {
        const details = JSON.parse(log.details || '{}');
        if (details.oldBarcode) {
          await prisma.product.update({
            where: { id: productId },
            data: { barcode: details.oldBarcode },
          });
          count++;
        }
      }
    }
    return count;
  }
}
