// ==================== MARKETPLACE SDK - ORTAK TİPLER V1.0 ====================
// Tüm pazaryerleri için ortak tip tanımlamaları
// ============================================================================

import { CorrelationId } from '../../eventBus/events.ts';

/** Desteklenen pazaryerleri */
export type MarketplaceKey = 'trendyol' | 'hepsiburada' | 'n11' | 'amazon' | 'pazarama' | 'ciceksepeti' | 'ikas' | 'woocommerce';

/** HTTP metodları */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** İstek öncelik seviyesi */
export type RequestPriority = 'HIGH' | 'NORMAL' | 'LOW';

/** API işlem tipleri */
export type OperationType =
  | 'createProduct' | 'updateProduct' | 'deleteProduct'
  | 'updateStock' | 'updatePrice'
  | 'getOrders' | 'updateOrder'
  | 'createShipment' | 'cancelOrder'
  | 'getCategories' | 'getBrands'
  | 'health' | 'testConnection'
  | 'closeListing' | 'openListing'
  | 'auth' | 'validate';

/** Pazaryeri bağlantı durumu */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'rate_limited' | 'auth_expired';

/** Ürün durumu */
export type ProductStatus = 'active' | 'inactive' | 'draft' | 'rejected' | 'pending';

/** Sipariş durumu */
export type OrderStatus =
  | 'new' | 'preparing' | 'shipped' | 'delivered'
  | 'cancelled' | 'returned' | 'refunded' | 'pending';

/** Pazaryeri kimlik bilgileri */
export interface MarketplaceCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
}

/** Pazaryeri yapılandırması */
export interface MarketplaceConfig {
  key: MarketplaceKey;
  name: string;
  baseUrl: string;
  credentials: MarketplaceCredentials;
  settings?: Record<string, any>;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxConcurrent: number;
  rateLimitPerSecond: number;
}

/** Ürün verisi (ortak) */
export interface MarketplaceProduct {
  sku: string;
  barcode?: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  stock: number;
  categoryId?: string;
  brandId?: string;
  images?: string[];
  variants?: MarketplaceVariant[];
  attributes?: Record<string, string>;
}

/** Varyant verisi (ortak) */
export interface MarketplaceVariant {
  sku: string;
  barcode?: string;
  title?: string;
  price?: number;
  stock?: number;
  attributes: Record<string, string>;
}

/** Sipariş verisi (ortak) */
export interface MarketplaceOrder {
  orderNo: string;
  status: OrderStatus;
  customerName: string;
  customerEmail?: string;
  items: MarketplaceOrderItem[];
  total: number;
  currency: string;
  cargoPrice?: number;
  commission?: number;
  address?: string;
  city?: string;
  district?: string;
  cargoCompany?: string;
  trackingNo?: string;
  createdAt: string;
}

/** Sipariş kalemi (ortak) */
export interface MarketplaceOrderItem {
  sku: string;
  barcode?: string;
  title: string;
  quantity: number;
  price: number;
}

/** Kargo bilgisi (ortak) */
export interface MarketplaceShipment {
  orderNo: string;
  cargoCompany: string;
  trackingNo: string;
  cargoUrl?: string;
  shipmentDate?: string;
}

/** Kategori (ortak) */
export interface MarketplaceCategory {
  id: string;
  name: string;
  parentId?: string;
  path?: string;
  subCategories?: MarketplaceCategory[];
}

/** Marka (ortak) */
export interface MarketplaceBrand {
  id: string;
  name: string;
  logo?: string;
}

/** Sağlık metrikleri (ortak) */
export interface MarketplaceHealthMetrics {
  healthy: boolean;
  latency: number;
  successRate: number;
  totalRequests: number;
  errorCount: number;
  rateLimitCount: number;
  avgResponseTime: number;
  lastCheckedAt: string;
}
