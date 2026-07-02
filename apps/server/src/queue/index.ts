import { Queue, type QueueOptions } from 'bullmq';
import { env } from '../env.ts';

// bullmq redis options
export const bullmqConnection = {
  host: env.REDIS_URL.replace(/^redis:\/\//, '').split(':')[0],
  port: Number(env.REDIS_URL.replace(/^redis:\/\//, '').split(':')[1] ?? 6379),
};

const baseQueueOpts: QueueOptions = {
  connection: bullmqConnection,
};

const queueEnabled = String(process.env.ENABLE_WORKERS ?? 'false').toLowerCase() === 'true';

export const queues = {
  actions: queueEnabled ? new Queue('dg-stok-actions', baseQueueOpts) : null,
};

