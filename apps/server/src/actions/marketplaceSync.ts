import { queues } from '../queue/index.ts';
import { prisma } from '../db/prisma.ts';
import type { MarketplaceSyncJobPayload } from '../queue/jobTypes.ts';

export async function enqueueMarketplaceSync(payload: MarketplaceSyncJobPayload, actor?: { userId: string; role: string }) {
  const marketplaceKey = payload.marketplaceKey;
  const totalSteps = payload.totalSteps ?? 5;

  const idempotencyKey = `marketplace.sync:${marketplaceKey}`; // demo-friendly; adjust to include time/window if needed

  // idempotency: if exists, don't enqueue again
  const existing = await prisma.queueJob.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return { ok: true, skipped: true, job: existing };
  }

  await prisma.queueJob.create({
    data: {
      idempotencyKey,
      jobType: 'marketplace.sync',
      status: 'queued',
      attempts: 0,
      payload: JSON.stringify({ ...payload, totalSteps, actor }),
    },
  });

  if (queues.actions) {
    await queues.actions.add(
      'marketplace.sync',
      {
        marketplaceKey,
        totalSteps,
      },
      {
        jobId: idempotencyKey,
      }
    );

    return { ok: true, enqueued: true, job: { idempotencyKey } };
  }

  return { ok: true, enqueued: false, skipped: true, reason: 'workers_disabled', job: { idempotencyKey } };
}

