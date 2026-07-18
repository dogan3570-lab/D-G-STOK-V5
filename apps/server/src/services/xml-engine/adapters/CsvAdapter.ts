// ==================== CSV ADAPTER V5 ====================
// CSV veri kaynakları için adapter
// =====================================================

import type { IDataSourceAdapter } from '../XmlEngineV5.ts';

export class CsvAdapter implements IDataSourceAdapter {
  readonly type = 'csv' as const;

  async parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }> {
    const errors: string[] = [];
    let total = 0;

    try {
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        return { total: 0, errors: ['CSV file has no data rows'] };
      }

      // Başlık satırını parse et
      const headers = this.parseCsvLine(lines[0]);
      const headerMap = headers.map(h => this.normalizeHeader(h));

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCsvLine(lines[i]);
          const product: Record<string, any> = {};

          for (let j = 0; j < headerMap.length; j++) {
            const key = headerMap[j];
            let value: any = values[j]?.trim() ?? '';

            // Sayısal değerleri dönüştür
            if (['stock', 'price', 'salePrice', 'purchasePrice', 'vatRate', 'minStock'].includes(key)) {
              const num = parseFloat(value.replace(',', '.'));
              if (!isNaN(num)) value = num;
            }

            product[key] = value;
          }

          // xmlKey oluştur
          product.xmlKey = product.barcode || product.productCode || product.sku || '';

          if (product.xmlKey) {
            onProduct(product);
            total++;
          }
        } catch (err: any) {
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`CSV parse error: ${err.message}`);
    }

    return { total, errors };
  }

  async parseAll(content: string): Promise<{ products: Record<string, any>[]; errors: string[] }> {
    const products: Record<string, any>[] = [];
    const { total, errors } = await this.parse(content, (p) => products.push(p));
    return { products, errors };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private normalizeHeader(header: string): string {
    const map: Record<string, string> = {
      'urun_adi': 'title',
      'urun adi': 'title',
      'product name': 'title',
      'product_name': 'title',
      'isim': 'title',
      'name': 'title',
      'title': 'title',
      'urun_kodu': 'productCode',
      'urun kodu': 'productCode',
      'product code': 'productCode',
      'product_code': 'productCode',
      'kod': 'productCode',
      'barkod': 'barcode',
      'barcode': 'barcode',
      'stok': 'stock',
      'stock': 'stock',
      'adet': 'stock',
      'miktar': 'stock',
      'fiyat': 'salePrice',
      'price': 'salePrice',
      'satis fiyat': 'salePrice',
      'alis fiyat': 'purchasePrice',
      'purchase price': 'purchasePrice',
      'kdv': 'vatRate',
      'vat': 'vatRate',
      'aciklama': 'description',
      'description': 'description',
      'marka': 'brand',
      'brand': 'brand',
      'kategori': 'category',
      'category': 'category',
      'resim': 'images',
      'image': 'images',
      'images': 'images',
      'sku': 'sku',
    };

    const lower = header.toLowerCase().trim();
    return map[lower] || lower;
  }
}
