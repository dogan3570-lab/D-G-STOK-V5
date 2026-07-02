import { Worker } from 'bullmq';
import { queues } from '../queue/index.ts';
import { prisma } from '../db/prisma.ts';
import { broadcastSSE } from '../sse/events.ts';
import type { MarketplaceSyncJobPayload } from '../queue/jobTypes.ts';

const actionsQueue = queues.actions;

export function startWorkers() {
  if (!actionsQueue) {
    // eslint-disable-next-line no-console
    console.log('[workers] actions queue is disabled; worker startup skipped');
    return null;
  }

  // one worker instance is enough for local dev; scale with more processes.
  const worker = new Worker(
    actionsQueue.name,
    async (job) => {
      const jobType = String(job.name ?? '');
      const idempotencyKey = String(job.opts?.jobId ?? job.id ?? '');

      if (jobType === 'marketplace.sync') {
        const payload = job.data as MarketplaceSyncJobPayload;
        const totalSteps = payload.totalSteps ?? 5;

        // upsert progress by writing state records (demo-friendly)
        const marketplace = await prisma.marketplace.findUnique({
          where: { key: payload.marketplaceKey },
        });

        if (!marketplace) {
          throw new Error(`Marketplace not found: ${payload.marketplaceKey}`);
        }

        broadcastSSE('marketplace.sync.start', {
          marketplace: marketplace.key,
          jobId: idempotencyKey || job.id,
        });

        for (let step = 1; step <= totalSteps; step++) {
          // Simulate work; real impl: call ERP/market API and update ProductMarketplaceState.
          await new Promise((r) => setTimeout(r, 500));

          // lightweight progress update
          await prisma.queueJob.updateMany({
            where: {
              idempotencyKey: idempotencyKey || undefined,
            },
            data: {
              status: 'processing',
            },
          });

          broadcastSSE('marketplace.sync.progress', {
            marketplace: marketplace.key,
            jobId: idempotencyKey || job.id,
            currentStep: step,
            totalSteps,
          });
        }

        await prisma.queueJob.updateMany({
          where: {
            idempotencyKey: idempotencyKey || undefined,
          },
          data: {
            status: 'done',
          },
        });

        broadcastSSE('marketplace.sync.done', {
          marketplace: marketplace.key,
          jobId: idempotencyKey || job.id,
        });

        return { ok: true };
      }

      throw new Error(`Unknown jobType: ${jobType}`);
    },
    {
      connection: (actionsQueue as any).opts.connection,
      // bullmq attempts/removal is mainly controlled at job/add-time.
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
        count: 1000,
      },
    }
  );

  worker.on('failed', async (job, err) => {
    const idempotencyKey = String(job?.opts?.jobId ?? job?.id ?? '');

    await prisma.queueJob.updateMany({
      where: {
        idempotencyKey: idempotencyKey || undefined,
      },
      data: {
        status: 'failed',
      },
    });

    broadcastSSE('queue.failed', {
      jobId: job?.id,
      idempotencyKey: idempotencyKey || null,
      jobType: job?.name,
      message: err?.message ?? String(err),
    });
  });

  return worker;
}

