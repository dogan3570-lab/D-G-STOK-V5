// ==================== FTP ADAPTER V5 ====================
// FTP/FTPS sunucularından veri indirip ürünlere dönüştürür
// =======================================================

import * as ftp from 'basic-ftp';
import type { IDataSourceAdapter } from '../XmlEngineV5.ts';
import { XmlAdapter } from './XmlAdapter.ts';
import { JsonAdapter } from './JsonAdapter.ts';
import { CsvAdapter } from './CsvAdapter.ts';
import { ExcelAdapter } from './ExcelAdapter.ts';

export interface FtpConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  filePath: string;
  secure?: boolean;
  fileType?: 'xml' | 'json' | 'csv' | 'excel';
  encoding?: string;
}

export class FtpAdapter implements IDataSourceAdapter {
  readonly type = 'ftp' as const;

  private config?: FtpConfig;

  setConfig(config: FtpConfig): void {
    this.config = config;
  }

  async parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }> {
    // Content direkt dosya içeriği olarak gelir
    const fileType = this.detectFileType(content);
    const adapter = this.getParserAdapter(fileType);
    return adapter.parse(content, onProduct);
  }

  async parseAll(content: string): Promise<{ products: Record<string, any>[]; errors: string[] }> {
    const products: Record<string, any>[] = [];
    const { total, errors } = await this.parse(content, (p) => products.push(p));
    return { products, errors };
  }

  /**
   * FTP sunucusundan dosya indirir ve içeriği döndürür
   */
  async downloadFromFtp(ftpConfig: FtpConfig): Promise<string> {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port || 21,
        user: ftpConfig.username || 'anonymous',
        password: ftpConfig.password || '',
        secure: ftpConfig.secure || ftpConfig.port === 990,
        secureOptions: { rejectUnauthorized: false },
      });

      const chunks: Buffer[] = [];
      await client.downloadTo(
        new (require('stream').Writable)({
          write(chunk: Buffer, _: any, callback: Function) {
            chunks.push(chunk);
            callback();
          },
        }),
        ftpConfig.filePath
      );

      client.close();
      return Buffer.concat(chunks).toString((ftpConfig.encoding || 'utf-8') as BufferEncoding);
    } catch (error: any) {
      client.close();
      throw new Error(`FTP download failed: ${error.message}`);
    }
  }

  private detectFileType(content: string): 'xml' | 'json' | 'csv' | 'excel' {
    if (this.config?.fileType) return this.config.fileType;
    
    const trimmed = content.trim();
    if (trimmed.startsWith('<')) return 'xml';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('PK') || trimmed.startsWith('\x50\x4b')) return 'excel';
    
    // CSV kontrolü: virgül/tab ile ayrılmış satırlar
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 1 && (lines[0].includes(',') || lines[0].includes('\t'))) return 'csv';
    
    return 'xml'; // Varsayılan
  }

  private getParserAdapter(type: 'xml' | 'json' | 'csv' | 'excel'): IDataSourceAdapter {
    switch (type) {
      case 'xml': return new XmlAdapter();
      case 'json': return new JsonAdapter();
      case 'csv': return new CsvAdapter();
      case 'excel': return new ExcelAdapter();
    }
  }
}
