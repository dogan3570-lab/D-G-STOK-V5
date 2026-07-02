export type SseEventName =
  | 'ping'
  | 'marketplace.sync.start'
  | 'marketplace.sync.progress'
  | 'marketplace.sync.done'
  | 'marketplace.sync.duplicate'
  | 'queue.failed'
  | 'sse.error';

export type SseEvent<T = unknown> = {
  event: SseEventName;
  data: T;
};

export type SyncActionSuccessResponse = {
  ok: true;
  skipped?: boolean;
  enqueued?: boolean;
  job?: {
    id?: string;
    idempotencyKey?: string;
    [key: string]: unknown;
  };
};

export type SyncActionErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type SyncActionResponse = SyncActionSuccessResponse | SyncActionErrorResponse;

export type SseLogItem = {
  event: SseEventName;
  data: unknown;
  ts: number;
};

export type DashboardSummaryItem = {
  marketplaceId: string;
  marketplaceName: string;
  ready: number;
  sent: number;
  passive: number;
  error: number;
  total: number;
};

export type MarketplaceItem = {
  id: string;
  name: string;
  key: string;
  apiStatus?: string | null;
};

export type ProductItem = {
  id: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number;
  createdAt?: string;
};

export type HealthPayload = {
  ok?: boolean;
  service?: string;
  [key: string]: unknown;
};

export type XmlSourceItem = {
  id: string;
  name: string;
  type: 'xml' | 'yml' | 'csv' | 'excel';
  url: string;
  status: 'active' | 'error' | 'paused';
  lastCheckAt?: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  marketplaceKey: string;
  categoryPath: string;
  active: boolean;
  updatedAt: string;
};

export type ShipmentItem = {
  id: string;
  channel: string;
  cargoCompany: string;
  trackingNo: string;
  status: 'queued' | 'processing' | 'shipped' | 'delivered' | 'failed';
  createdAt: string;
};

export type OrderItem = {
  id: string;
  orderNo: string;
  channel: string;
  customerName: string;
  status: 'new' | 'preparing' | 'shipped' | 'cancelled' | 'returned';
  total: number;
  createdAt: string;
};

export type ReportKpi = {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'flat';
};

export type SettingsGroup = {
  id: string;
  title: string;
  description: string;
  items: Array<{ key: string; value: string; sensitive?: boolean }>;
};
