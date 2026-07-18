import Client from 'ssh2-sftp-client';
import type { IDataProvider, ProviderConfig, ProviderResult, ProviderInfo } from './IDataProvider.ts';
import type { XmlV2Product } from '../xmlv2/types.ts';
import { decrypt } from './CryptoHelper.ts';

export class SftpProvider implements IDataProvider {
  readonly info: ProviderInfo = {
    type: 'sftp',
    name: 'SFTP Provider',
    description: 'SFTP (SSH File Transfer Protocol) sunucularindan dosya okur',
    version: '1.0.0',
    supportsStreaming: true,
    supportsSchedule: true,
  };

  async fetch(config: ProviderConfig): Promise<ProviderResult> {
    const start = Date.now();
    const client = new Client();

    try {
      if (!config.host) {
        return { ok: false, products: [], totalCount: 0, error: 'SFTP host zorunludur', durationMs: 0 };
      }

      const connectConfig: any = {
        host: config.host,
        port: config.port || 22,
        username: config.username || 'root',
        readyTimeout: 30000,
        algorithms: { serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256'] },
      };

      if (config.privateKey) {
        connectConfig.privateKey = decrypt(config.privateKey);
        if (config.password) connectConfig.passphrase = decrypt(config.password);
      } else if (config.password) {
        connectConfig.password = decrypt(config.password);
      }

      await client.connect(connectConfig);

      const fileName = config.filePath || 'products.xml';
      const chunks: Buffer[] = [];

      const stream = await client.get(fileName);
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      await client.end();
      const content = Buffer.concat(chunks).toString(config.encoding || 'utf-8' as any);

      const products = parseSFTPContent(content, start);

      return { ok: true, products, totalCount: products.length, durationMs: Date.now() - start };
    } catch (error: any) {
      try { await client.end(); } catch {}
      return { ok: false, products: [], totalCount: 0, error: error.message, durationMs: Date.now() - start };
    }
  }

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string }> {
    const client = new Client();
    try {
      const connectConfig: any = {
        host: config.host || '',
        port: config.port || 22,
        username: config.username || 'root',
        readyTimeout: 15000,
      };

      if (config.privateKey) {
        connectConfig.privateKey = decrypt(config.privateKey);
        if (config.password) connectConfig.passphrase = decrypt(config.password);
      } else if (config.password) {
        connectConfig.password = decrypt(config.password);
      }

      await client.connect(connectConfig);
      await client.end();
      return { ok: true, message: 'SFTP baglantisi basarili' };
    } catch (error: any) {
      try { await client.end(); } catch {}
      return { ok: false, message: error.message };
    }
  }

  validateConfig(config: ProviderConfig): string[] {
    const errors: string[] = [];
    if (!config.host) errors.push('SFTP host zorunludur');
    if (!config.username) errors.push('SFTP kullanici adi zorunludur');
    if (!config.password && !config.privateKey) errors.push('Sifre veya Private Key zorunludur');
    return errors;
  }
}

function parseSFTPContent(content: string, start: number): XmlV2Product[] {
  const products: XmlV2Product[] = [];
  try {
    if (content.trim().startsWith('<')) {
      const productRegex = /<(?:product|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      const matches = Array.from(content.matchAll(productRegex));
      matches.forEach((match, i) => {
        const c = match[1];
        products.push({
          xmlKey: extractTagValue(c, 'xmlKey') || extractTagValue(c, 'id') || `SFTP-${i}`,
          title: extractTagValue(c, 'title') || extractTagValue(c, 'name') || null,
          sku: extractTagValue(c, 'sku') || `SFTP-SKU-${i}`,
          barcode: extractTagValue(c, 'barcode') || null,
          stock: Number(extractTagValue(c, 'stock') || 0),
          minStock: Number(extractTagValue(c, 'minStock') || 0),
          price: extractTagValue(c, 'price') ? Number(extractTagValue(c, 'price')) : null,
          listPrice: extractTagValue(c, 'listPrice') ? Number(extractTagValue(c, 'listPrice')) : null,
          tax: null, currency: null,
          brand: extractTagValue(c, 'brand') || null,
          category: extractTagValue(c, 'category') || null,
          mainCategory: null, topCategory: null, subCategory: null,
          description: extractTagValue(c, 'description') || null,
          detail: null,
          images: extractTagValue(c, 'images') || null,
          link: null, unit: null, active: true,
        });
      });
    } else if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : (data.products || data.items || []);
      items.forEach((item: any, i: number) => {
        products.push({
          xmlKey: String(item.id || item.xmlKey || `SFTP-${i}`),
          title: item.title || item.name || null,
          sku: String(item.sku || `SFTP-SKU-${i}`),
          barcode: item.barcode || null,
          stock: Number(item.stock || 0), minStock: Number(item.minStock || 0),
          price: item.price ? Number(item.price) : null,
          listPrice: item.listPrice ? Number(item.listPrice) : null,
          tax: null, currency: null,
          brand: item.brand || null, category: item.category || null,
          mainCategory: null, topCategory: null, subCategory: null,
          description: item.description || null, detail: null,
          images: item.images ? (Array.isArray(item.images) ? item.images.join(',') : String(item.images)) : null,
          link: null, unit: null, active: true,
        });
      });
    }
  } catch {}
  return products;
}

function extractTagValue(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(content);
  return match ? match[1].trim() : null;
}
