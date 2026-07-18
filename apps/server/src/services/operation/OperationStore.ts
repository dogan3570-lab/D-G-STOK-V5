import { prisma } from '../../db/prisma.ts';
import type { Operation, OperationType, OperationStatus } from './types.ts';
import { v4 as uuid } from 'uuid';

const STORE_PREFIX = 'op_';

export class OperationStore {
  // Kuyrugu DB'ye kaydet
  async save(op: Operation): Promise<void> {
    await prisma.queueJob.upsert({
      where: { idempotencyKey: `${STORE_PREFIX}${op.id}` },
      update: {
        status: op.status,
        attempts: op.retryCount,
        lastError: op.error,
        payload: JSON.stringify(op),
      },
      create: {
        id: op.id,
        jobType: op.type,
        idempotencyKey: `${STORE_PREFIX}${op.id}`,
        status: op.status,
        attempts: op.retryCount,
        lastError: op.error,
        payload: JSON.stringify(op),
      },
    });
  }

  // Kuyruktan yukle
  async load(id: string): Promise<Operation | null> {
    const job = await prisma.queueJob.findUnique({
      where: { idempotencyKey: `${STORE_PREFIX}${id}` },
    });
    if (!job) return null;
    return JSON.parse(job.payload) as Operation;
  }

  // Tum bekleyen isleri yukle (restart recovery)
  async loadAllPending(): Promise<Operation[]> {
    const jobs = await prisma.queueJob.findMany({
      where: {
        jobType: { startsWith: '' },
        status: { in: ['queued', 'processing', 'retrying'] },
      },
    });
    return jobs.map(j => JSON.parse(j.payload) as Operation);
  }

  // Durum guncelle
  async updateStatus(id: string, status: OperationStatus, error?: string): Promise<void> {
    await prisma.queueJob.update({
      where: { idempotencyKey: `${STORE_PREFIX}${id}` },
      data: { status, lastError: error, updatedAt: new Date() },
    });
  }

  // DLQ'ya tasi
  async moveToDLQ(op: Operation, reason: string): Promise<void> {
    await prisma.queueJob.update({
      where: { idempotencyKey: `${STORE_PREFIX}${op.id}` },
      data: {
        status: 'failed',
        lastError: `DLQ: ${reason}`,
        updatedAt: new Date(),
      },
    });
  }

  // Istatistikler
  async getStats(): Promise<{
    total: number; queued: number; processing: number;
    completed: number; failed: number; retrying: number;
  }> {
    const [total, queued, processing, completed, failed, retrying] = await Promise.all([
      prisma.queueJob.count(),
      prisma.queueJob.count({ where: { status: 'queued' } }),
      prisma.queueJob.count({ where: { status: 'processing' } }),
      prisma.queueJob.count({ where: { status: 'completed' } }),
      prisma.queueJob.count({ where: { status: 'failed' } }),
      prisma.queueJob.count({ where: { status: 'retrying' } }),
    ]);
    return { total, queued, processing, completed, failed, retrying };
  }
}
