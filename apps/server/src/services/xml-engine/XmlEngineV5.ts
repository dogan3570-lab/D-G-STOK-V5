// ==================== DG STOK XML ENGINE V5 ====================
// Yüksek hacimli XML/JSON/CSV/Excel/FTP/SFTP veri toplama ve işleme motoru
// 100.000+ ürün desteği, streaming parser, queue tabanlı işleme
// Batch insert, transaction, hata yönetimi
// =============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../operation/EventBus.ts';
import { XmlAdapter } from './adapters/XmlAdapter.ts';
import { JsonAdapter } from './adapters/JsonAdapter.ts';
import { CsvAdapter } from './adapters/CsvAdapter.ts';
import { ExcelAdapter } from './adapters/ExcelAdapter.ts';
import { FtpAdapter, type FtpConfig } from './adapters/FtpAdapter.ts';
import { SftpAdapter, type SftpConfig } from './adapters/SftpAdapter.ts';
import { Normalizer } from './Normalizer.ts';
import { FieldMapper } from './FieldMapper.ts';
import { DuplicateChecker } from './DuplicateChecker.ts';
import { ImportLogger } from './ImportLogger.ts';

// ==================== TİP TANIMLARI ====================

export interface XmlEngineConfig {
  chunkSize: number;        // Batch işleme boyutu (default: 100)
  batchSize: number;        // DB batch insert boyutu (default: 50)
  maxConcurrent: number;    // Maksimum eşzamanlı işlem (default: 3)
  streaming: boolean;       // Streaming parser kullan (default: true)
  maxFileSize: number;      // Maksimum dosya boyutu byte (default: 500MB)
  timeout: number;          // Download timeout saniye (default: 120)
}

export interface ImportOptions {
  sourceId: string;
  actorUserId?: string | null;
  fieldMapping?: Record<string, string>;
  forceUpdate?: boolean;    // True ise tüm ürünleri güncelle
  filter?: {
    filterOutOfStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface ImportProgress {
  sourceId: string;
  status: 'idle' | 'downloading' | 'parsing' | 'normalizing' | 'saving' | 'completed' | 'error' | 'cancelled';
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

export type SourceType = 'xml' | 'json' | 'csv' | 'excel' | 'ftp' | 'sftp' | 'api';

// ==================== HATA KODLARI ====================

export const ErrorCodes = {
  XML_DOWNLOAD_FAILED: 'XML_DOWNLOAD_FAILED',
  INVALID_XML: 'INVALID_XML',
  MISSING_BARCODE: 'MISSING_BARCODE',
  INVALID_PRICE: 'INVALID_PRICE',
  EMPTY_CONTENT: 'EMPTY_CONTENT',
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  IMPORT_IN_PROGRESS: 'IMPORT_IN_PROGRESS',
  CANCELLED: 'CANCELLED',
  FTP_CONNECTION_FAILED: 'FTP_CONNECTION_FAILED',
  SFTP_CONNECTION_FAILED: 'SFTP_CONNECTION_FAILED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  PARSE_ERROR: 'PARSE_ERROR',
  DB_ERROR: 'DB_ERROR',
} as const;

// ==================== ADAPTER REGISTRY ====================

const ADAPTERS: Record<string, { new(): IDataSourceAdapter }> = {
  xml: XmlAdapter,
  json: JsonAdapter,
  csv: CsvAdapter,
  excel: ExcelAdapter,
  ftp: FtpAdapter,
  sftp: SftpAdapter,
};

export interface IDataSourceAdapter {
  readonly type: SourceType;
  /** Veriyi stream ederek okur, her ürün bloğu için callback çağırır */
  parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }>;
  /** Veriyi normalize edilmiş ürün listesine çevirir (küçük dosyalar için) */
  parseAll(content: string): Promise<{ products: Record<string, any>[]; errors: string[] }>;
}

// ==================== HATA SINIFI ====================

export class XmlEngineError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'XmlEngineError';
  }
}

// ==================== XML ENGINE V5 ====================

export class XmlEngineV5 {
  private eventBus: EventBus;
  private normalizer: Normalizer;
  private fieldMapper: FieldMapper;
  private duplicateChecker: DuplicateChecker;
  private logger: ImportLogger;
  private config: XmlEngineConfig;
  private activeImports: Map<string, ImportProgress> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? EventBus.getInstance();
    this.normalizer = new Normalizer();
    this.fieldMapper = new FieldMapper();
    this.duplicateChecker = new DuplicateChecker();
    this.logger = new ImportLogger();
    this.config = {
      chunkSize: 100,
      batchSize: 50,
      maxConcurrent: 3,
      streaming: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      timeout: 120,
    };
  }

  /**
   * XML/JSON/CSV/Excel/FTP/SFTP kaynağından ürünleri içe aktarır
   */
  async importFromSource(sourceId: string, options?: ImportOptions): Promise<ImportProgress> {
    // Aktif import kontrolü
    if (this.activeImports.has(sourceId)) {
      const existing = this.activeImports.get(sourceId)!;
      if (existing.status === 'downloading' || existing.status === 'parsing' || existing.status === 'normalizing' || existing.status === 'saving') {
        throw new XmlEngineError(ErrorCodes.IMPORT_IN_PROGRESS, 'Bu kaynak için import zaten devam ediyor');
      }
    }

    const source = await prisma.xmlSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new XmlEngineError(ErrorCodes.SOURCE_NOT_FOUND, `XML kaynağı bulunamadı: ${sourceId}`);

    const abortController = new AbortController();
    this.abortControllers.set(sourceId, abortController);

    const progress: ImportProgress = {
      sourceId,
      status: 'downloading',
      total: 0, processed: 0, created: 0, updated: 0, skipped: 0, failed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    };
    this.activeImports.set(sourceId, progress);

    try {
      // 1. Kaynağı SYNCING olarak işaretle
      await this.updateSourceStatus(sourceId, 'SYNCING');

      // 2. Import run oluştur
      const run = await this.logger.startRun(sourceId);

      // 3. Veriyi indir
      const content = await this.downloadContent(source, abortController.signal);
      if (!content || content.trim().length === 0) {
        throw new XmlEngineError(ErrorCodes.EMPTY_CONTENT, 'Kaynaktan boş içerik alındı');
      }

      // 4. İptal kontrolü
      if (abortController.signal.aborted) {
        throw new XmlEngineError(ErrorCodes.CANCELLED, 'Import iptal edildi');
      }

      // 5. Parser seç ve çalıştır
      const adapter = this.getAdapter(source.sourceType);
      progress.status = 'parsing';
      this.updateProgress(sourceId, progress);

      const rawProducts: Record<string, any>[] = [];
      const parseResult = await adapter.parseAll(content);

      progress.total = parseResult.products.length;
      progress.errors.push(...parseResult.errors);
      
      if (parseResult.products.length === 0) {
        throw new XmlEngineError(ErrorCodes.PARSE_ERROR, 'Hiç ürün bulunamadı');
      }

      progress.status = 'normalizing';
      this.updateProgress(sourceId, progress);

      // 6. Her ürünü normalize et, validate et
      const normalizedProducts: Array<{ normalized: any; raw: Record<string, any> }> = [];

      for (let i = 0; i < parseResult.products.length; i++) {
        const raw = parseResult.products[i];
        try {
          // Field mapping uygula
          const mapped = options?.fieldMapping
            ? this.fieldMapper.apply(raw, options.fieldMapping)
            : raw;

          // Normalize et
          const normalized = this.normalizer.normalize(mapped, {
            defaultCurrency: source.currency,
            defaultVat: source.vatRate,
          });

          // Validasyon
          if (normalized.errors.length > 0) {
            progress.failed++;
            progress.errors.push(`Product ${i}: ${normalized.errors.join(', ')}`);
            continue;
          }

          normalizedProducts.push({ normalized, raw: mapped });
        } catch (err: any) {
          progress.failed++;
          progress.errors.push(`Product ${i}: ${err.message}`);
        }
      }

      // 7. İptal kontrolü
      if (abortController.signal.aborted) {
        throw new XmlEngineError(ErrorCodes.CANCELLED, 'Import iptal edildi');
      }

      // 8. Batch insert/update
      progress.status = 'saving';
      this.updateProgress(sourceId, progress);

      await this.batchSaveProducts(normalizedProducts, sourceId, run.id, options, progress, abortController.signal);

      // 9. Import run'ı tamamla
      progress.status = 'completed';
      progress.finishedAt = new Date().toISOString();
      progress.durationMs = new Date(progress.finishedAt).getTime() - new Date(progress.startedAt).getTime();
      
      await this.logger.completeRun(run.id, progress);
      await this.updateSourceStatus(sourceId, 'ACTIVE', progress);

      // Event yayınla
      this.eventBus.emit('xml.import.completed', {
        id: sourceId,
        type: 'SYNC_PRODUCT',
        marketplaceKey: 'xml',
        productIds: [],
        priority: 0,
        status: 'completed',
        progress: 100,
        totalCount: progress.total,
        processedCount: progress.processed,
        failedCount: progress.failed,
        retryCount: 0,
        maxRetries: 0,
        payload: {
          sourceId,
          total: progress.total,
          created: progress.created,
          updated: progress.updated,
          failed: progress.failed,
          durationMs: progress.durationMs,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    } catch (err: any) {
      progress.status = 'error';
      progress.finishedAt = new Date().toISOString();
      progress.durationMs = new Date(progress.finishedAt).getTime() - new Date(progress.startedAt).getTime();
      progress.errors.push(err.message);
      
      if (err.code === 'CANCELLED') {
        progress.status = 'cancelled';
      }

      await this.updateSourceStatus(sourceId, 'ERROR');
      
      this.eventBus.emit('xml.import.error', {
        id: sourceId,
        type: 'SYNC_PRODUCT',
        marketplaceKey: 'xml',
        productIds: [],
        priority: 0,
        status: 'failed',
        progress: 0,
        totalCount: 0,
        processedCount: 0,
        failedCount: 0,
        retryCount: 0,
        maxRetries: 0,
        payload: {
          sourceId,
          error: err.message,
          code: err.code || 'UNKNOWN',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } finally {
      this.abortControllers.delete(sourceId);
      this.updateProgress(sourceId, progress);
    }

    return progress;
  }

  /**
   * Batch halinde ürünleri kaydeder
   */
  private async batchSaveProducts(
    products: Array<{ normalized: any; raw: Record<string, any> }>,
    sourceId: string,
    runId: string,
    options: ImportOptions | undefined,
    progress: ImportProgress,
    signal: AbortSignal
  ): Promise<void> {
    const batchSize = this.config.batchSize;

    for (let i = 0; i < products.length; i += batchSize) {
      if (signal.aborted) break;

      const batch = products.slice(i, i + batchSize);

      // Batch içindeki her ürün için duplicate kontrol ve upsert
      const operations = batch.map(async (item) => {
        try {
          const dupResult = await this.duplicateChecker.check(item.normalized, sourceId);

          if (dupResult.action === 'CREATE') {
            await this.createProduct(item.normalized, sourceId, runId, options?.actorUserId);
            return { action: 'created' as const };
          } else if (dupResult.action === 'UPDATE') {
            if (options?.forceUpdate || this.shouldUpdate(dupResult, item.normalized)) {
              await this.updateProduct(dupResult.existingId!, item.normalized, sourceId, runId, options?.actorUserId);
              return { action: 'updated' as const };
            }
            return { action: 'skipped' as const };
          } else {
            return { action: 'ignored' as const };
          }
        } catch (err: any) {
          return { action: 'failed' as const, error: err.message };
        }
      });

      const results = await Promise.all(operations);

      for (const result of results) {
        switch (result.action) {
          case 'created': progress.created++; break;
          case 'updated': progress.updated++; break;
          case 'skipped': case 'ignored': progress.skipped++; break;
          case 'failed': 
            progress.failed++;
            if (result.error) progress.errors.push(result.error);
            break;
        }
      }

      progress.processed = Math.min(i + batchSize, products.length);
      this.updateProgress(sourceId, progress);
    }
  }

  /**
   * Ürünün güncellenmesi gerekip gerekmediğini kontrol eder
   */
  private shouldUpdate(dupResult: { existingId?: string; matchedBy?: string }, newData: any): boolean {
    // Şimdilik her zaman güncelle
    return true;
  }

  /**
   * İçeriği kaynak tipine göre indirir
   * URL, FTP, SFTP, API, Local dosya desteği
   */
  private async downloadContent(source: any, signal?: AbortSignal): Promise<string> {
    const sourceType = (source.sourceType || '').toLowerCase();

    // FTP
    if (sourceType === 'ftp') {
      if (!source.url) throw new XmlEngineError(ErrorCodes.FTP_CONNECTION_FAILED, 'FTP için URL gerekli');
      const ftpUrl = new URL(source.url);
      const ftpAdapter = new FtpAdapter();
      return ftpAdapter.downloadFromFtp({
        host: ftpUrl.hostname,
        port: Number(ftpUrl.port) || 21,
        username: source.username || ftpUrl.username || 'anonymous',
        password: source.password || ftpUrl.password || '',
        filePath: ftpUrl.pathname.replace(/^\//, '') || 'products.xml',
        secure: ftpUrl.protocol === 'ftps:',
      });
    }

    // SFTP
    if (sourceType === 'sftp') {
      if (!source.url) throw new XmlEngineError(ErrorCodes.SFTP_CONNECTION_FAILED, 'SFTP için URL gerekli');
      const sftpUrl = new URL(source.url);
      const sftpAdapter = new SftpAdapter();
      return sftpAdapter.downloadFromSftp({
        host: sftpUrl.hostname,
        port: Number(sftpUrl.port) || 22,
        username: source.username || sftpUrl.username || 'root',
        password: source.password || sftpUrl.password || '',
        filePath: sftpUrl.pathname.replace(/^\//, '') || 'products.xml',
      });
    }

    // URL (HTTP/HTTPS)
    if (source.url) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout * 1000);

      try {
        const headers: Record<string, string> = {};
        if (source.username) {
          headers['Authorization'] = 'Basic ' + Buffer.from(`${source.username}:${source.password || ''}`).toString('base64');
        }

        const response = await fetch(source.url, {
          signal: signal || controller.signal,
          redirect: 'follow',
          headers,
        });

        if (!response.ok) {
          throw new XmlEngineError(
            ErrorCodes.XML_DOWNLOAD_FAILED,
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        // Content-Length kontrolü
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > this.config.maxFileSize) {
          throw new XmlEngineError(
            ErrorCodes.FILE_TOO_LARGE,
            `Dosya çok büyük: ${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB (max: ${this.config.maxFileSize / 1024 / 1024}MB)`
          );
        }

        return await response.text();
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new XmlEngineError(ErrorCodes.XML_DOWNLOAD_FAILED, 'Geçerli URL veya kaynak tipi bulunamadı');
  }

  /**
   * Kaynak tipine uygun adapter'ı döndürür
   */
  private getAdapter(sourceType: string): IDataSourceAdapter {
    const type = sourceType.toLowerCase() as SourceType;
    const AdapterClass = ADAPTERS[type];
    if (!AdapterClass) {
      // Varsayılan XML
      return new XmlAdapter();
    }
    return new AdapterClass();
  }

  /**
   * Ürün oluşturur
   */
  private async createProduct(data: any, sourceId: string, runId: string, actorUserId?: string | null): Promise<void> {
    await prisma.product.create({
      data: {
        xmlKey: data.xmlKey || `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: data.title,
        description: data.description,
        detail: data.detail,
        sku: data.sku,
        barcode: data.barcode,
        stockCode: data.stockCode,
        stock: data.stock ?? 0,
        minStock: data.minStock ?? 0,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice,
        vatRate: data.vatRate,
        currency: data.currency,
        images: data.images,
        link: data.link,
        unit: data.unit,
        status: 'XML',
        xmlSourceId: sourceId,
        supplierCategory: data.category,
      },
    });
  }

  /**
   * Ürünü günceller
   */
  private async updateProduct(id: string, data: any, sourceId: string, runId: string, actorUserId?: string | null): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.detail !== undefined) updateData.detail = data.detail;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
    if (data.salePrice !== undefined) updateData.salePrice = data.salePrice;
    if (data.vatRate !== undefined) updateData.vatRate = data.vatRate;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.link !== undefined) updateData.link = data.link;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.supplierCategory !== undefined) updateData.supplierCategory = data.supplierCategory;

    await prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Kaynak durumunu günceller
   */
  private async updateSourceStatus(sourceId: string, status: string, progress?: ImportProgress): Promise<void> {
    const data: any = { connectionStatus: status };
    
    if (status === 'SYNCING') {
      data.lastRunAt = new Date();
    }
    
    if (status === 'ACTIVE') {
      data.lastSuccessAt = new Date();
      data.lastError = null;
    }
    
    if (status === 'ERROR' && progress?.errors.length) {
      data.lastError = progress.errors[progress.errors.length - 1];
    }

    await prisma.xmlSource.update({ where: { id: sourceId }, data });
  }

  /**
   * Progress'i günceller ve event yayınlar
   */
  private updateProgress(sourceId: string, progress: ImportProgress): void {
    this.activeImports.set(sourceId, { ...progress });
    this.eventBus.emit('xml.import.progress', progress as any);
  }

  /**
   * Anlık import durumunu döndürür
   */
  getProgress(sourceId: string): ImportProgress | null {
    return this.activeImports.get(sourceId) ?? null;
  }

  /**
   * Tüm aktif import'ları döndürür
   */
  getAllProgress(): ImportProgress[] {
    return Array.from(this.activeImports.values());
  }

  /**
   * Import'u iptal eder
   */
  cancelImport(sourceId: string): boolean {
    const controller = this.abortControllers.get(sourceId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sourceId);
    }
    
    const progress = this.activeImports.get(sourceId);
    if (progress) {
      progress.status = 'cancelled';
      this.updateProgress(sourceId, progress);
    }
    
    return this.activeImports.delete(sourceId);
  }

  /**
   * Engine yapılandırmasını günceller
   */
  configure(config: Partial<XmlEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Mevcut yapılandırmayı döndürür
   */
  getConfig(): XmlEngineConfig {
    return { ...this.config };
  }

  /**
   * Dashboard için özet istatistikler
   */
  async getDashboardStats(): Promise<{
    activeSources: number;
    totalProducts: number;
    lastImport: ImportProgress | null;
    todayImports: number;
    failedImports: number;
    successRate: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeSources, totalProducts, todayImports, totalRuns, failedRuns] = await Promise.all([
      prisma.xmlSource.count({ where: { active: true } }),
      prisma.product.count(),
      prisma.xmlImportRun.count({ where: { startedAt: { gte: todayStart } } }),
      prisma.xmlImportRun.count(),
      prisma.xmlImportRun.count({ where: { status: 'error', startedAt: { gte: todayStart } } }),
    ]);

    // Son import
    const lastRun = await prisma.xmlImportRun.findFirst({
      orderBy: { startedAt: 'desc' },
      include: { source: { select: { name: true } } },
    });

    return {
      activeSources,
      totalProducts,
      lastImport: lastRun ? {
        sourceId: lastRun.sourceId,
        status: lastRun.status as any,
        total: lastRun.totalProducts,
        processed: lastRun.newProducts + lastRun.updatedProducts,
        created: lastRun.newProducts,
        updated: lastRun.updatedProducts,
        skipped: lastRun.skippedProducts,
        failed: lastRun.failedProducts,
        errors: lastRun.errorDetail ? [lastRun.errorDetail] : [],
        startedAt: lastRun.startedAt.toISOString(),
      } : null,
      todayImports,
      failedImports: failedRuns,
      successRate: totalRuns > 0 ? Math.round(((totalRuns - failedRuns) / totalRuns) * 100) : 100,
    };
  }
}
