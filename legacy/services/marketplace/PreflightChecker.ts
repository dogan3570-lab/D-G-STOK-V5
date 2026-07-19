import { prisma } from '../../db/prisma.ts';
import { ForbiddenWordEngine } from './ForbiddenWordEngine.ts';

export interface PreflightResult {
  productId: string;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
  score: number;
  errors: number;
  warnings: number;
}

export class PreflightChecker {
  private wordEngine = new ForbiddenWordEngine();

  async check(productId: string): Promise<PreflightResult> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
        variants: true,
        marketplaceStates: { include: { marketplace: true } },
      },
    });

    if (!product) {
      return { productId, passed: false, checks: [], score: 0, errors: 1, warnings: 0 };
    }

    const checks: PreflightResult['checks'] = [];
    let errors = 0, warnings = 0;

    // 1. Kategori
    if (product.categoryId && product.category) {
      checks.push({ name: 'Kategori', passed: true, message: `Kategori: ${product.category.name}` });
    } else {
      checks.push({ name: 'Kategori', passed: false, message: 'Kategori atanmamis' });
      errors++;
    }

    // 2. Marka
    if (product.brandId && product.brand) {
      checks.push({ name: 'Marka', passed: true, message: `Marka: ${product.brand.name}` });
    } else {
      checks.push({ name: 'Marka', passed: false, message: 'Marka atanmamis' });
      errors++;
    }

    // 3. Varyant
    if (product.variants.length > 0) {
      checks.push({ name: 'Varyant', passed: true, message: `${product.variants.length} varyant` });
    } else {
      checks.push({ name: 'Varyant', passed: true, message: 'Varyantsiz (onayli)' });
    }

    // 4. Barkod
    if (product.barcode) {
      checks.push({ name: 'Barkod', passed: true, message: `Barkod: ${product.barcode}` });
    } else {
      checks.push({ name: 'Barkod', passed: false, message: 'Barkod eksik' });
      errors++;
    }

    // 5. Fiyat
    if (product.salePrice && product.salePrice > 0) {
      checks.push({ name: 'Fiyat', passed: true, message: `${product.salePrice} TL` });
    } else {
      checks.push({ name: 'Fiyat', passed: false, message: 'Fiyat gecersiz' });
      errors++;
    }

    // 6. Stok
    if (product.stock >= 0) {
      checks.push({ name: 'Stok', passed: true, message: `${product.stock} adet` });
    } else {
      checks.push({ name: 'Stok', passed: false, message: 'Stok negatif' });
      errors++;
    }

    // 7. Baslik
    if (product.title && product.title.length >= 5) {
      checks.push({ name: 'Baslik', passed: true, message: `${product.title.length} karakter` });
    } else {
      checks.push({ name: 'Baslik', passed: false, message: 'Baslik cok kisa veya eksik' });
      errors++;
    }

    // 8. Aciklama
    if (product.description && product.description.length >= 20) {
      checks.push({ name: 'Aciklama', passed: true, message: `${product.description.length} karakter` });
    } else {
      checks.push({ name: 'Aciklama', passed: false, message: 'Aciklama cok kisa veya eksik' });
      warnings++;
    }

    // 9. Gorsel
    if (product.images) {
      const imgCount = product.images.split(',').filter(u => u.trim()).length;
      checks.push({ name: 'Gorsel', passed: imgCount >= 1, message: `${imgCount} gorsel` });
      if (imgCount < 1) errors++;
    } else {
      checks.push({ name: 'Gorsel', passed: false, message: 'Gorsel yok' });
      errors++;
    }

    // 10. Yasakli Kelime
    const brandName = product.brand?.name ?? null;
    const wordCheck = await this.wordEngine.checkProduct(product.title, product.description, brandName);
    if (wordCheck.totalIssues > 0) {
      checks.push({ name: 'Yasakli Kelime', passed: false, message: `${wordCheck.totalIssues} yasakli kelime bulundu` });
      warnings++;
    } else {
      checks.push({ name: 'Yasakli Kelime', passed: true, message: 'Temiz' });
    }

    // 11. Pazaryeri
    if (product.marketplaceStates.length > 0) {
      const activeMP = product.marketplaceStates.filter(s => s.marketplace.active).length;
      checks.push({ name: 'Pazaryeri', passed: activeMP > 0, message: `${activeMP} aktif pazaryeri` });
    } else {
      checks.push({ name: 'Pazaryeri', passed: false, message: 'Pazaryeri atanmamis' });
      warnings++;
    }

    const score = Math.max(0, 100 - (errors * 15 + warnings * 5));
    const passed = errors === 0;

    return { productId, passed, checks, score, errors, warnings };
  }

  async batchCheck(productIds: string[]): Promise<PreflightResult[]> {
    const results: PreflightResult[] = [];
    for (const id of productIds) {
      results.push(await this.check(id));
    }
    return results;
  }
}
