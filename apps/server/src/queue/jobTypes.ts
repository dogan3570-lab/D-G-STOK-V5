export type MarketplaceSyncJobPayload = {
  marketplaceKey: string;
  // progress/demo için
  totalSteps?: number;
};

export type QueueJobType =
  | { type: 'marketplace.sync'; payload: MarketplaceSyncJobPayload };

export function getJobType(job: QueueJobType['type']): string {
  return String(job);
}

