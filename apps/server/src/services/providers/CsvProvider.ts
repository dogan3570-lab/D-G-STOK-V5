import type { IDataProvider, ProviderConfig, ProviderResult, ProviderInfo } from './IDataProvider.ts';
import type { XmlV2Product } from '../xmlv2/types.ts';

export class CsvProvider implements IDataProvider {
  readonly info: ProviderInfo = {
    type: 'csv',
    name: 'CSV Provider',
    description: 'CSV formatindaki veri kaynaklarini okur',
    version: '1.0.0',
    supportsStreaming: true,
    supportsSchedule: true,
  };

  async fetch(config: ProviderConfig): Promise<ProviderResult> {
    const start = Date.now();
    try {
      if (!config.url) {
        return { ok: false, products: [], totalCount: 0, error: 'URL gerekli', durationMs: 0 };
      }

      const response = await fetch(config.url);
      const text = await response.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      
      if (lines.length < 2) {
        return { ok: false, products: [], totalCount: 0, error: 'CSV en az 2 satir icermeli', durationMs: Date.now() - start };
      }

      const headers = lines[0].split(config.delimiter || ',').map(h => h.trim().toLowerCase());
      const products: XmlV2Product[] = [];
      
      const fieldMap: Record<string, string> = {
        id: 'xmlKey', 'xml key': 'xmlKey', xmlkey: 'xmlKey', sku: 'sku', code: 'sku',
        title: 'title', name: 'title', 'product name': 'title',
        barcode: 'barcode', upc: 'barcode', ean: 'barcode', gtin: 'barcode',
        stock: 'stock', quantity: 'stock', qty: 'stock',
        price: 'price', 'sale price': 'price', 'list price': 'listPrice',
        brand: 'brand', category: 'category',
        description: 'description', desc: 'description',
        image: 'images', 'image url': 'images', picture: 'images',
      };

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(config.delimiter || ',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        products.push({
          xmlKey: row.xmlkey || row.id || row.sku || `CSV-${i}`,
          title: row.title || row.name || null,
          sku: row.sku || row.code || `CSV-SKU-${i}`,
          barcode: row.barcode || row.upc || row.ean || null,
          stock: Number(row.stock || row.quantity || 0),
          minStock: Number(row.minstock || row.minstocklevel || 0),
          price: row.price ? Number(row.price) : null,
          listPrice: row.listprice ? Number(row.listprice) : null,
          tax: row.tax || row.vat ? Number(row.tax || row.vat) : null,
          currency: row.currency || null,
          brand: row.brand || null,
          category: row.category || null,
          mainCategory: row.maincategory || null,
          topCategory: row.topcategory || null,
          subCategory: row.subcategory || null,
          description: row.description || row.desc || null,
          detail: null,
          images: row.images || row.image || row.picture || null,
          link: row.link || row.url || null,
          unit: row.unit || null,
          active: row.active !== 'false' && row.active !== '0',
        });
      }

      return { ok: true, products, totalCount: products.length, durationMs: Date.now() - start };
    } catch (error: any) {
      return { ok: false, products: [], totalCount: 0, error: error.message, durationMs: Date.now() - start };
    }
  }

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(config.url || '', { method: 'HEAD' });
      return { ok: res.ok, message: `HTTP ${res.status}` };
    } catch (error: any) {
      return { ok: false, message: error.message };
    }
  }

  validateConfig(config: ProviderConfig): string[] {
    const errors: string[] = [];
    if (!config.url) errors.push('CSV kaynagi icin URL zorunludur');
    return errors;
  }
}
