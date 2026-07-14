// ==================== DG STOK V5.0 - GLOBAL TYPES ====================

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
  active?: boolean;
  logo?: string;
};

export type ProductItem = {
  id: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number;
  purchasePrice: number | null;
  salePrice: number | null;
  vatRate: number | null;
  profitMargin: number | null;
  images: string | null;
  status: string;
  errorMessage: string | null;
  aiScore: number | null;
  categoryMatch: boolean;
  brandMatch: boolean;
  variantMatch: boolean;
  templateMatch: boolean;
  categoryId: string | null;
  brandId: string | null;
  xmlSourceId: string | null;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string; company?: string | null } | null;
  variants?: Array<{ id: string; name: string; value: string }>;
  description?: string | null;
  originalTitle?: string | null;
  computedTitle?: string | null;
  prefixEnabled?: boolean;
  brandUsageType?: string;
  createdAt: string;
  updatedAt: string;
};

export type HealthPayload = {
  ok?: boolean;
  service?: string;
  [key: string]: unknown;
};

export type XmlSourceItem = {
  id: string;
  name: string;
  sourceType: string;
  url: string | null;
  active: boolean;
  company: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  connectionStatus: string;
  totalProducts?: number;
  categoryStatus?: string;
  variantStatus?: string;
  brandStatus?: string;
  attributeStatus?: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  marketplaceId: string | null;
  marketplaceKey?: string;
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

// ==================== URUN HAZIRLAMA TYPES ====================

export interface CategoryPrepStats {
  totalProducts: number;
  autoMatched: number;
  manualPending: number;
  errorCount: number;
  completionPercent: number;
}

export interface CategoryPrepItem {
  id: string;
  title: string | null;
  xmlKey: string;
  xmlCategory: string | null;
  selectedCategoryPath: string | null;
  aiScore: number | null;
  status: 'auto' | 'manual' | 'pending' | 'error';
  sku: string | null;
  barcode: string | null;
  images: string | null;
  productId: string;
}

export interface BrandPrepItem {
  id: string;
  title: string | null;
  xmlKey: string;
  xmlBrand: string | null;
  dgBrandName: string | null;
  brandUsageType: string;
  prefixEnabled: boolean;
  computedTitle: string | null;
  originalTitle: string | null;
  status: 'ok' | 'pending';
}

export interface VariantPrepItem {
  id: string;
  title: string | null;
  xmlKey: string;
  parentSku: string;
  childSku: string | null;
  color: string | null;
  size: string | null;
  numberValue: string | null;
  status: 'ready' | 'partial' | 'pending' | 'error';
}

export interface ListingRule {
  id: string;
  minPrice: number;
  maxPrice: number;
  profitMargin: number;
  fixedAmount: number;
  rounding: string;
}

export interface ListingPricePreview {
  purchasePrice: number;
  salePrice: number;
  vat: number;
  commission: number;
  profit: number;
  profitMargin: number;
  finalPrice: number;
}

// ==================== GONDERIME HAZIR TYPES ====================

export interface ReadyProductItem {
  id: string;
  title: string | null;
  xmlKey: string;
  sku: string | null;
  barcode: string | null;
  stock: number;
  salePrice: number | null;
  categoryMatch: boolean;
  brandMatch: boolean;
  variantMatch: boolean;
  templateMatch: boolean;
  categoryName: string | null;
  brandName: string | null;
  imageCount: number;
  xmlSourceName: string | null;
  status: string;
  updatedAt: string;
}

// ==================== PAZARYERI YONETIMI TYPES ====================

export interface SendLogItem {
  id: string;
  productId: string;
  marketplaceId: string;
  status: string;
  message: string | null;
  createdAt: string;
  productTitle?: string;
  marketplaceName?: string;
}

export interface MarketplaceSendRequest {
  productIds: string[];
  marketplaceId: string;
  xmlSourceId?: string;
}
