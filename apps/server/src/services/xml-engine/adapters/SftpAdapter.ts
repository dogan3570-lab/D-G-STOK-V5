// ==================== SFTP ADAPTER V5 ====================
// SFTP (SSH File Transfer Protocol) sunucularından veri indirip ürünlere dönüştürür
// =========================================================

import Client from 'ssh2-sftp-client';
import type { IDataSourceAdapter } from '../XmlEngineV5.ts';
import { XmlAdapter } from './XmlAdapter.ts';
import { JsonAdapter } from './JsonAdapter.ts';
import { CsvAdapter } from './CsvAdapter.ts';
import { ExcelAdapter } from './ExcelAdapter.ts';

export interface SftpConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  filePath: string;
  fileType?: 'xml' | 'json' | 'csv' | 'excel';
  encoding?: string;
}

export class SftpAdapter implements IDataSourceAdapter {
  readonly type = 'sftp' as const;

  private config?: SftpConfig;

  setConfig(config: SftpConfig): void {
    this.config = config;
  }

  async parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }> {
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
   * SFTP sunucusundan dosya indirir ve içeriği döndürür
   */
  async downloadFromSftp(sftpConfig: SftpConfig): Promise<string> {
    const client = new Client();

    try {
      const connectConfig: any = {
        host: sftpConfig.host,
        port: sftpConfig.port || 22,
        username: sftpConfig.username || 'root',
        readyTimeout: 30000,
        algorithms: { serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256'] },
      };

      if (sftpConfig.privateKey) {
        connectConfig.privateKey = sftpConfig.privateKey;
        if (sftpConfig.passphrase) connectConfig.passphrase = sftpConfig.passphrase;
      } else if (sftpConfig.password) {
        connectConfig.password = sftpConfig.password;
      }

      await client.connect(connectConfig);

      const chunks: Buffer[] = [];
      const stream = await client.get(sftpConfig.filePath);
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      await client.end();
      return Buffer.concat(chunks).toString(sftpConfig.encoding || 'utf-8' as any);
    } catch (error: any) {
      try { await client.end(); } catch {}
      throw new Error(`SFTP download failed: ${error.message}`);
    }
  }

  private detectFileType(content: string): 'xml' | 'json' | 'csv' | 'excel' {
    if (this.config?.fileType) return this.config.fileType;
    
    const trimmed = content.trim();
    if (trimmed.startsWith('<')) return 'xml';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('PK') || trimmed.startsWith('\x50\x4b')) return 'excel';
    
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 1 && (lines[0].includes(',') || lines[0].includes('\t'))) return 'csv';
    
    return 'xml';
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
