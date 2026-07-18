export type OperationType =
  | 'LIST_PRODUCT' | 'UPDATE_PRICE' | 'UPDATE_STOCK'
  | 'DELETE_PRODUCT' | 'ACTIVATE_PRODUCT' | 'DEACTIVATE_PRODUCT'
  | 'SYNC_PRODUCT' | 'SYNC_ORDER' | 'SYNC_CATEGORY' | 'SYNC_BRAND';

export type OperationStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export interface Operation {
  id: string;
  type: OperationType;
  marketplaceKey: string;
  productIds: string[];
  priority: number;
  status: OperationStatus;
  progress: number; // 0-100
  totalCount: number;
  processedCount: number;
  failedCount: number;
  retryCount: number;
  maxRetries: number;
  payload: any;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface OperationEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'retrying' | 'cancelled';
  operationId: string;
  timestamp: Date;
  data?: any;
}

export interface OperationStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  progress: number;
  eta: number;
  speed: number; // urun/sn
}
