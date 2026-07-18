import { prisma } from '../../db/prisma.ts';

interface ErrorGroup {
  errorCode: string;
  marketplaceKey: string;
  count: number;
  lastOccurrence: Date;
  sampleMessage: string;
  affectedProducts: number;
  fixable: boolean;
  suggestion: string;
}

export class ErrorAnalyzer {
  async getErrors(marketplaceKey?: string, limit = 100): Promise<any[]> {
    const where: any = {};
    if (marketplaceKey) where.marketplaceKey = marketplaceKey;

    const errors = await prisma.apiErrorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return errors.map(e => ({
      id: e.id,
      productId: e.productId,
      marketplaceKey: e.marketplaceKey,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      rejectedField: e.rejectedField,
      aiLearnedRule: e.aiLearnedRule,
      applied: e.applied,
      createdAt: e.createdAt,
    }));
  }

  async getErrorGroups(): Promise<ErrorGroup[]> {
    const errors = await prisma.apiErrorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const groups = new Map<string, ErrorGroup>();

    for (const e of errors) {
      const key = `${e.errorCode}_${e.marketplaceKey}`;
      const existing = groups.get(key);

      if (existing) {
        existing.count++;
        existing.lastOccurrence = e.createdAt;
        if (groups.size < 100) existing.sampleMessage = e.errorMessage;
      } else {
        groups.set(key, {
          errorCode: e.errorCode,
          marketplaceKey: e.marketplaceKey,
          count: 1,
          lastOccurrence: e.createdAt,
          sampleMessage: e.errorMessage,
          affectedProducts: 1,
          fixable: this.isFixable(e.errorCode),
          suggestion: this.getSuggestion(e.errorCode, e.rejectedField),
        });
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  }

  async getStats(): Promise<{ total: number; grouped: number; topErrors: Array<{ code: string; count: number }> }> {
    const total = await prisma.apiErrorLog.count();
    const groups = await this.getErrorGroups();
    return {
      total,
      grouped: groups.length,
      topErrors: groups.slice(0, 5).map(g => ({ code: g.errorCode, count: g.count })),
    };
  }

  private isFixable(errorCode: string): boolean {
    const fixableCodes = ['PRICE_ERROR', 'STOCK_ERROR', 'TITLE_ERROR', 'DESCRIPTION_ERROR', 'BRAND_ERROR'];
    return fixableCodes.includes(errorCode);
  }

  private getSuggestion(errorCode: string, _field?: string | null): string {
    const suggestions: Record<string, string> = {
      PRICE_ERROR: 'Fiyat araligini kontrol edin. Minimum alis fiyatini guncelleyin.',
      STOCK_ERROR: 'Stok miktarini guncelleyin. Stok 0 ise pasife alin.',
      TITLE_ERROR: 'Basligi kontrol edin. Yasakli kelime veya ASCII disi karakter olabilir.',
      IMAGE_ERROR: 'Gorsel URL\'lerini kontrol edin. Minimum 800x800 cozunurluk gerekli.',
      CATEGORY_ERROR: 'Kategori eslestirmesini kontrol edin.',
      BRAND_ERROR: 'Marka eslestirmesini kontrol edin.',
      BARCODE_ERROR: 'Barkod formatini kontrol edin.',
    };
    return suggestions[errorCode] || 'Hata kodunu inceleyin.';
  }
}
