// ==================== XML IMPORT WORKER V5 ====================
// Arka planda XML/JSON/CSV/Excel/FTP/SFTP import işlemlerini yürütür
// Queue tabanlı, UI kilitlenmeden çalışır
// =============================================================

import { Worker } from 'bullmq';
import { queues, bullmqConnection } from '../../queue/index.ts';
import { prisma } from '../../db/prisma.ts';
import { broadcastSSE } from '../../sse/events.ts';
import { xmlEngineV5 } from './index.ts';
import type { ImportProgress } from './XmlEngineV5.ts';

// ==================== JOB TYPES ====================

export const XML_IMPORT_QUEUE = 'dg-stok-xml-import';
export const XML_IMPORT_JOB = 'xml.import';

export interface XmlImportJobPayload {
  sourceId: string;
  actorUserId?: string | null;
  forceUpdate?: boolean;
}

// ==================== WORKER ====================

let workerInstance: Worker | null = null;

/**
 * XML Import Worker'ı başlatır
 */
export function startXmlImportWorker(): Worker | null {
  if (workerInstance) return workerInstance;

  const queue = queues.actions;
  if (!queue) {
    console.log('[XmlImportWorker] Queue is disabled; worker startup skipped');
    return null;
  }

  workerInstance = new Worker(
    queue.name,
    async (job) => {
      const jobType = String(job.name ?? '');

      if (jobType === XML_IMPORT_JOB) {
        const payload = job.data as XmlImportJobPayload;
        const { sourceId, actorUserId, forceUpdate } = payload;

        // Başlangıç bildirimi
        broadcastSSE('xml.import.start', {
          sourceId,
          jobId: job.id,
        });

        try {
          // XML Engine ile import'u başlat
          const progress = await xmlEngineV5.importFromSource(sourceId, {
            sourceId,
            actorUserId,
            forceUpdate,
          });

          // Tamamlandı bildirimi
          broadcastSSE('xml.import.completed', {
            sourceId,
            jobId: job.id,
            progress,
          });

          return { ok: true, progress };
        } catch (error: any) {
          broadcastSSE('xml.import.error', {
            sourceId,
            jobId: job.id,
            error: error.message,
          });
          throw error;
        }
      }

      throw new Error(`Unknown job type: ${jobType}`);
    },
    {
      connection: bullmqConnection,
      concurrency: 2, // Aynı anda en fazla 2 XML import
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 100 },
    }
  );

  workerInstance.on('failed', async (job, err) => {
    console.error(`[XmlImportWorker] Job ${job?.id} failed:`, err.message);
    broadcastSSE('xml.import.error', {
      jobId: job?.id,
      error: err.message,
    });

    // Import run'ı hata olarak işaretle
    if (job?.data?.sourceId) {
      try {
        const runningRun = await prisma.xmlImportRun.findFirst({
          where: { sourceId: job.data.sourceId, status: 'running' },
          orderBy: { startedAt: 'desc' },
        });
        if (runningRun) {
          await prisma.xmlImportRun.update({
            where: { id: runningRun.id },
            data: {
              status: 'error',
              finishedAt: new Date(),
              errorDetail: err.message,
            },
          });
        }
        await prisma.xmlSource.update({
          where: { id: job.data.sourceId },
          data: {
            connectionStatus: 'ERROR',
            lastError: err.message,
          },
        });
      } catch (dbErr) {
        console.error('[XmlImportWorker] Failed to update error status:', dbErr);
      }
    }
  });

  workerInstance.on('completed', async (job) => {
    console.log(`[XmlImportWorker] Job ${job?.id} completed successfully`);
  });

  console.log('[XmlImportWorker] Worker started successfully');
  return workerInstance;
}

/**
 * XML import işini queue'ya ekler
 */
export async function enqueueXmlImport(
  sourceId: string,
  options?: { actorUserId?: string | null; forceUpdate?: boolean }
): Promise<{ ok: boolean; jobId?: string; error?: string }> {
  const queue = queues.actions;
  if (!queue) {
    // Queue yoksa direkt çalıştır
    try {
      const progress = await xmlEngineV5.importFromSource(sourceId, {
        sourceId,
        actorUserId: options?.actorUserId ?? null,
        forceUpdate: options?.forceUpdate,
      });
      return { ok: progress.status === 'completed' };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  try {
    const job = await queue.add(XML_IMPORT_JOB, {
      sourceId,
      actorUserId: options?.actorUserId ?? null,
      forceUpdate: options?.forceUpdate ?? false,
    } as XmlImportJobPayload, {
      jobId: `xml-import-${sourceId}-${Date.now()}`,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
      attempts: 1, // Tekrar deneme yok, manuel
    });

    return { ok: true, jobId: job.id };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Worker'ı durdurur
 */
export function stopXmlImportWorker(): void {
  if (workerInstance) {
    workerInstance.close();
    workerInstance = null;
    console.log('[XmlImportWorker] Worker stopped');
  }
}
