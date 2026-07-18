// ==================== IMPORT LOG SİSTEMİ V5 ====================
// Her XML import işlemini kayıt altına alır
// ===========================================================

import { prisma } from '../../db/prisma.ts';
import type { ImportProgress } from './XmlEngineV5.ts';

export interface ImportRunRecord {
  id: string;
  sourceId: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  failedProducts: number;
  errorDetail: string | null;
}

export class ImportLogger {
  /**
   * Yeni bir import run kaydı oluşturur
   */
  async startRun(sourceId: string): Promise<ImportRunRecord> {
    const run = await prisma.xmlImportRun.create({
      data: {
        sourceId,
        status: 'running',
        startedAt: new Date(),
      },
    });
    return run;
  }

  /**
   * Import run'ı tamamlar
   */
  async completeRun(runId: string, progress: ImportProgress): Promise<void> {
    await prisma.xmlImportRun.update({
      where: { id: runId },
      data: {
        status: progress.status === 'completed' ? 'completed' : 'error',
        finishedAt: new Date(),
        durationMs: Date.now() - new Date(progress.startedAt).getTime(),
        totalProducts: progress.total,
        newProducts: progress.created,
        updatedProducts: progress.updated,
        skippedProducts: progress.skipped,
        failedProducts: progress.failed,
        errorDetail: progress.errors.length > 0 ? progress.errors.join('\n') : null,
      },
    });
  }

  /**
   * Kaynağa ait son import run'ları getirir
   */
  async getRecentRuns(sourceId: string, limit = 20): Promise<ImportRunRecord[]> {
    return prisma.xmlImportRun.findMany({
      where: { sourceId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Tüm kaynaklar için import istatistikleri
   */
  async getGlobalStats(): Promise<{
    totalRuns: number;
    totalProducts: number;
    totalCreated: number;
    totalUpdated: number;
    totalFailed: number;
    todayRuns: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalRuns, totalProducts, totalCreated, totalUpdated, totalFailed, todayRuns] = await Promise.all([
      prisma.xmlImportRun.count(),
      prisma.xmlImportRun.aggregate({ _sum: { totalProducts: true } }),
      prisma.xmlImportRun.aggregate({ _sum: { newProducts: true } }),
      prisma.xmlImportRun.aggregate({ _sum: { updatedProducts: true } }),
      prisma.xmlImportRun.aggregate({ _sum: { failedProducts: true } }),
      prisma.xmlImportRun.count({ where: { startedAt: { gte: todayStart } } }),
    ]);

    return {
      totalRuns,
      totalProducts: totalProducts._sum.totalProducts ?? 0,
      totalCreated: totalCreated._sum.newProducts ?? 0,
      totalUpdated: totalUpdated._sum.updatedProducts ?? 0,
      totalFailed: totalFailed._sum.failedProducts ?? 0,
      todayRuns,
    };
  }
}
