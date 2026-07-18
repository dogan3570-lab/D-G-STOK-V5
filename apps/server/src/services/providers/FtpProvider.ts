import * as ftp from 'basic-ftp';
import type { IDataProvider, ProviderConfig, ProviderResult, ProviderInfo } from './IDataProvider.ts';
import type { XmlV2Product } from '../xmlv2/types.ts';
import { decrypt } from './CryptoHelper.ts';

export class FtpProvider implements IDataProvider {
  readonly info: ProviderInfo = {
    type: 'ftp',
    name: 'FTP/FTPS Provider',
    description: 'FTP ve FTPS sunucularindan dosya okur',
    version: '1.0.0',
    supportsStreaming: true,
    supportsSchedule: true,
  };

  async fetch(config: ProviderConfig): Promise<ProviderResult> {
    const start = Date.now();
    const client = new ftp.Client();

    try {
      if (!config.host) {
        return { ok: false, products: [], totalCount: 0, error: 'FTP host zorunludur', durationMs: 0 };
      }

      const password = config.password ? decrypt(config.password) : '';
      client.ftp.verbose = false;

      await client.access({
        host: config.host,
        port: config.port || 21,
        user: config.username || 'anonymous',
        password: password,
        secure: config.port === 990, // FTPS
        secureOptions: { rejectUnauthorized: true },
      });

      const fileName = config.filePath || 'products.xml';
      const chunks: Buffer[] = [];

      await client.downloadTo(
        new (require('stream').Writable)({
          write(chunk: Buffer, _: any, callback: Function) {
            chunks.push(chunk);
            callback();
          },
        }),
        fileName
      );

      client.close();
      const content = Buffer.concat(chunks).toString((config.encoding || 'utf-8') as BufferEncoding);

      // XML parse et (basit)
      const products = parseTextToProducts(content, start);

      return { ok: true, products, totalCount: products.length, durationMs: Date.now() - start };
    } catch (error: any) {
      client.close();
      return { ok: false, products: [], totalCount: 0, error: error.message, durationMs: Date.now() - start };
    }
  }

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string }> {
    const client = new ftp.Client();
    try {
      const password = config.password ? decrypt(config.password) : '';
      await client.access({
        host: config.host || '',
        port: config.port || 21,
        user: config.username || 'anonymous',
        password,
        secure: config.port === 990,
        secureOptions: { rejectUnauthorized: true },
      });
      client.close();
      return { ok: true, message: 'FTP baglantisi basarili' };
    } catch (error: any) {
      client.close();
      return { ok: false, message: error.message };
    }
  }

  validateConfig(config: ProviderConfig): string[] {
    const errors: string[] = [];
    if (!config.host) errors.push('FTP host zorunludur');
    if (!config.username) errors.push('FTP kullanici adi zorunludur');
    return errors;
  }
}

function parseTextToProducts(content: string, start: number): XmlV2Product[] {
  const products: XmlV2Product[] = [];
  try {
    // XML format
    if (content.trim().startsWith('<')) {
      const productRegex = /<(?:product|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      const matches = Array.from(content.matchAll(productRegex));
      matches.forEach((match, i) => {
        const c = match[1];
        products.push({
          xmlKey: extractTag(c, 'xmlKey') || extractTag(c, 'id') || `FTP-${i}`,
          title: extractTag(c, 'title') || extractTag(c, 'name') || null,
          sku: extractTag(c, 'sku') || `FTP-SKU-${i}`,
          barcode: extractTag(c, 'barcode') || null,
          stock: Number(extractTag(c, 'stock') || 0),
          minStock: Number(extractTag(c, 'minStock') || 0),
          price: extractTag(c, 'price') ? Number(extractTag(c, 'price')) : null,
          listPrice: extractTag(c, 'listPrice') ? Number(extractTag(c, 'listPrice')) : null,
          tax: null, currency: null,
          brand: extractTag(c, 'brand') || null,
          category: extractTag(c, 'category') || null,
          mainCategory: null, topCategory: null, subCategory: null,
          description: extractTag(c, 'description') || null,
          detail: null,
          images: extractTag(c, 'images') || null,
          link: null, unit: null, active: true,
        });
      });
    }
    // JSON format
    else if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : (data.products || data.items || []);
      items.forEach((item: any, i: number) => {
        products.push({
          xmlKey: String(item.id || item.xmlKey || `FTP-${i}`),
          title: item.title || item.name || null,
          sku: String(item.sku || `FTP-SKU-${i}`),
          barcode: item.barcode || null,
          stock: Number(item.stock || 0),
          minStock: Number(item.minStock || 0),
          price: item.price ? Number(item.price) : null,
          listPrice: item.listPrice ? Number(item.listPrice) : null,
          tax: null, currency: null,
          brand: item.brand || null,
          category: item.category || null,
          mainCategory: null, topCategory: null, subCategory: null,
          description: item.description || null,
          detail: null,
          images: item.images ? (Array.isArray(item.images) ? item.images.join(',') : String(item.images)) : null,
          link: null, unit: null, active: true,
        });
      });
    }
    // CSV format
    else {
      const lines = content.split(/\r?\n/).filter(l => l.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
          products.push({
            xmlKey: row.id || row.xmlkey || `FTP-${i}`,
            title: row.title || row.name || null,
            sku: row.sku || `FTP-SKU-${i}`,
            barcode: row.barcode || null,
            stock: Number(row.stock || 0),
            minStock: Number(row.minstock || 0),
            price: row.price ? Number(row.price) : null,
            listPrice: row.listprice ? Number(row.listprice) : null,
            tax: null, currency: null,
            brand: row.brand || null,
            category: row.category || null,
            mainCategory: null, topCategory: null, subCategory: null,
            description: row.description || null,
            detail: null,
            images: row.images || null,
            link: null, unit: null, active: true,
          });
        }
      }
    }
  } catch { /* ignore parse errors */ }
  return products;
}

function extractTag(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(content);
  if (!match) return null;
  return match[1].trim() || null;
}
