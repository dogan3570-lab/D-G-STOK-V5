import type { IDataProvider, ProviderConfig, ProviderResult, ProviderInfo } from './IDataProvider.ts';
import type { XmlV2Product } from '../xmlv2/types.ts';

export class JsonProvider implements IDataProvider {
  readonly info: ProviderInfo = {
    type: 'json',
    name: 'JSON Provider',
    description: 'JSON formatindaki veri kaynaklarini okur',
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
      if (!response.ok) {
        return { ok: false, products: [], totalCount: 0, error: `HTTP ${response.status}`, durationMs: Date.now() - start };
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.products || data.items || data.data || []);
      
      const products: XmlV2Product[] = items.map((item: any, i: number) => ({
        xmlKey: String(item.id || item.xmlKey || item.sku || `JSON-${i}`),
        title: item.title || item.name || null,
        sku: String(item.sku || item.code || `SKU-${i}`),
        barcode: item.barcode || item.upc || item.ean || null,
        stock: Number(item.stock || item.quantity || item.qty || 0),
        minStock: Number(item.minStock || item.minQuantity || 0),
        price: item.price || item.salePrice ? Number(item.price || item.salePrice) : null,
        listPrice: item.listPrice || item.purchasePrice ? Number(item.listPrice || item.purchasePrice) : null,
        tax: item.tax || item.vat ? Number(item.tax || item.vat) : null,
        currency: item.currency || null,
        brand: item.brand || null,
        category: item.category || null,
        mainCategory: item.mainCategory || null,
        topCategory: item.topCategory || null,
        subCategory: item.subCategory || null,
        description: item.description || item.desc || null,
        detail: item.detail || null,
        images: item.images ? (Array.isArray(item.images) ? item.images.join(',') : String(item.images)) : null,
        link: item.link || item.url || null,
        unit: item.unit || null,
        active: item.active !== false,
      }));

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
    if (!config.url) errors.push('JSON kaynagi icin URL zorunludur');
    return errors;
  }
}
