// ==================== IDataProvider ARAYUZU ====================
// DG STOK V5.0 - Faz 2: Provider Mimarisi
// Tum veri kaynaklari bu arayuzu uygular.
// ==============================================================

import type { XmlV2Product } from '../xmlv2/types.ts';

export type SourceType = 'xml' | 'json' | 'csv' | 'excel' | 'ftp' | 'sftp' | 'api';

export interface ProviderConfig {
  id?: string;
  name: string;
  sourceType: SourceType;
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string; // Sifrelenmis
  privateKey?: string; // Sifrelenmis (SFTP)
  filePath?: string;
  encoding?: string;
  delimiter?: string; // CSV
  sheetName?: string; // Excel
  apiKey?: string; // Sifrelenmis
  apiSecret?: string; // Sifrelenmis
  scheduleIntervalMinutes?: number;
  headers?: Record<string, string>; // API custom headers
}

export interface ProviderResult {
  ok: boolean;
  products: XmlV2Product[];
  totalCount: number;
  error?: string;
  durationMs: number;
}

export interface ProviderInfo {
  type: SourceType;
  name: string;
  description: string;
  version: string;
  supportsStreaming: boolean;
  supportsSchedule: boolean;
}

export interface IDataProvider {
  readonly info: ProviderInfo;
  
  /** Veri kaynagindan urunleri okur */
  fetch(config: ProviderConfig): Promise<ProviderResult>;
  
  /** Baglantiyi test eder */
  testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string }>;
  
  /** Provider'i yapilandirir */
  validateConfig(config: ProviderConfig): string[]; // Hata mesajlari
}
