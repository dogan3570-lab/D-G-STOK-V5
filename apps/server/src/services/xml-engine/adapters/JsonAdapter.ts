// ==================== JSON ADAPTER V5 ====================
// JSON veri kaynakları için adapter
// =====================================================

import type { IDataSourceAdapter } from '../XmlEngineV5.ts';

export class JsonAdapter implements IDataSourceAdapter {
  readonly type = 'json' as const;

  async parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }> {
    const errors: string[] = [];
    let total = 0;

    try {
      const data = JSON.parse(content);

      // Dizi var mı kontrol et
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.products && Array.isArray(data.products)) {
        items = data.products;
      } else if (data.items && Array.isArray(data.items)) {
        items = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else if (data.urunler && Array.isArray(data.urunler)) {
        items = data.urunler;
      } else {
        // Tek bir ürün nesnesi
        items = [data];
      }

      for (const item of items) {
        try {
          const normalized = this.normalizeJsonKeys(item);
          if (normalized.xmlKey || normalized.barcode || normalized.productCode) {
            onProduct(normalized);
            total++;
          }
        } catch (err: any) {
          errors.push(`Item ${total}: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`JSON parse error: ${err.message}`);
    }

    return { total, errors };
  }

  async parseAll(content: string): Promise<{ products: Record<string, any>[]; errors: string[] }> {
    const products: Record<string, any>[] = [];
    const { total, errors } = await this.parse(content, (p) => products.push(p));
    return { products, errors };
  }

  private normalizeJsonKeys(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    const map: Record<string, string> = {
      'urun_adi': 'title',
      'urunAdi': 'title',
      'product_name': 'title',
      'productName': 'title',
      'isim': 'title',
      'ad': 'title',
      'name': 'title',
      'title': 'title',
      'urun_kodu': 'productCode',
      'urunKodu': 'productCode',
      'product_code': 'productCode',
      'productCode': 'productCode',
      'kod': 'productCode',
      'barkod': 'barcode',
      'barcode': 'barcode',
      'stok': 'stock',
      'stock': 'stock',
      'adet': 'stock',
      'miktar': 'stock',
      'fiyat': 'salePrice',
      'sale_price': 'salePrice',
      'salePrice': 'salePrice',
      'price': 'salePrice',
      'alis_fiyat': 'purchasePrice',
      'alisFiyat': 'purchasePrice',
      'purchase_price': 'purchasePrice',
      'purchasePrice': 'purchasePrice',
      'kdv': 'vatRate',
      'vat_rate': 'vatRate',
      'vatRate': 'vatRate',
      'aciklama': 'description',
      'description': 'description',
      'marka': 'brand',
      'brand': 'brand',
      'kategori': 'category',
      'category': 'category',
      'resim': 'images',
      'images': 'images',
      'image': 'images',
      'sku': 'sku',
      'stockCode': 'stockCode',
    };

    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = map[key.toLowerCase()] || key;
      result[normalizedKey] = value;
    }

    // xmlKey oluştur
    if (!result.xmlKey) {
      result.xmlKey = result.barcode || result.productCode || result.sku || '';
    }

    return result;
  }
}
