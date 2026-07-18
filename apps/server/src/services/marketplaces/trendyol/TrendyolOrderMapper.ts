// ==================== TRENDYOL SİPARİŞ MAPPER V1.0 ====================
// Trendyol sipariş formatı ↔ MarketplaceOrder dönüşümü.
// Her iki yön de desteklenir.
// =====================================================================

import { MarketplaceOrder, MarketplaceOrderItem, OrderStatus } from '../core/MarketplaceTypes.ts';

/** Trendyol API sipariş yanıtı (paket seviyesi) */
export interface TrendyolPackage {
  id: number;
  orderNumber: string;
  supplierId: number;
  status: string;
  lineItems: TrendyolLineItem[];
  totalPrice: number;
  currencyCode: string;
  shipmentPackageStatus: string;
  createDateTime: string;
  lastModifiedDateTime: string;
  deliveryDate?: string;
  shipmentAddress?: TrendyolAddress;
  customerInfo?: TrendyolCustomer;
  cargoCompany?: string;
  cargoTrackingNumber?: string;
  cargoTrackingLink?: string;
  invoiceAddress?: TrendyolAddress;
  estimatedDeliveryDate?: string;
}

/** Trendyol API sipariş kalemi */
export interface TrendyolLineItem {
  id: number;
  barcode: string;
  stockCode: string;
  productName: string;
  quantity: number;
  price: number;
  currencyCode: string;
  orderNumber?: string;
}

/** Trendyol API müşteri */
export interface TrendyolCustomer {
  name: string;
  surname: string;
  email: string;
  phone: string;
}

/** Trendyol API adres */
export interface TrendyolAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  district: string;
  postalCode?: string;
  country: string;
  phone: string;
}

/** Trendyol sipariş listesi yanıtı */
export interface TrendyolOrdersResponse {
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolPackage[];
}

/** Sipariş durumu eşleme tablosu */
const STATUS_MAP: Record<string, OrderStatus> = {
  'NEW': 'new',
  'PICKING': 'preparing',
  'PACKING': 'preparing',
  'SHIPPED': 'shipped',
  'DELIVERED': 'delivered',
  'CANCELLED': 'cancelled',
  'RETURNED': 'returned',
  'REJECTED': 'cancelled',
  'UNPACKED': 'new',
  'INVOICED': 'shipped',
  'UNSUPPLIED': 'cancelled',
  'WAITING': 'pending',
};

/** Tersine durum eşleme (MarketplaceOrder → Trendyol) */
const REVERSE_STATUS_MAP: Record<string, string> = {
  'new': 'NEW',
  'preparing': 'PACKING',
  'shipped': 'SHIPPED',
  'delivered': 'DELIVERED',
  'cancelled': 'CANCELLED',
  'returned': 'RETURNED',
  'pending': 'WAITING',
};

/**
 * Trendyol Sipariş Mapper.
 * Trendyol paket formatını ortak MarketplaceOrder modeline çevirir.
 */
export class TrendyolOrderMapper {
  /**
   * Tek bir Trendyol paketini MarketplaceOrder'a çevir.
   */
  static toMarketplaceOrder(trendyolPackage: TrendyolPackage): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = (trendyolPackage.lineItems || []).map(item => ({
      sku: item.stockCode || item.barcode,
      barcode: item.barcode,
      title: item.productName,
      quantity: item.quantity,
      price: item.price,
    }));

    const customerName = trendyolPackage.customerInfo
      ? `${trendyolPackage.customerInfo.name} ${trendyolPackage.customerInfo.surname}`.trim()
      : trendyolPackage.shipmentAddress?.fullName || '';

    const address = trendyolPackage.shipmentAddress
      ? `${trendyolPackage.shipmentAddress.address1}${trendyolPackage.shipmentAddress.address2 ? ', ' + trendyolPackage.shipmentAddress.address2 : ''}, ${trendyolPackage.shipmentAddress.district}/${trendyolPackage.shipmentAddress.city}`
      : undefined;

    return {
      orderNo: trendyolPackage.orderNumber,
      status: this.toOrderStatus(trendyolPackage.status),
      customerName,
      customerEmail: trendyolPackage.customerInfo?.email,
      items,
      total: trendyolPackage.totalPrice,
      currency: trendyolPackage.currencyCode || 'TRY',
      cargoPrice: undefined,
      commission: undefined,
      address,
      city: trendyolPackage.shipmentAddress?.city,
      district: trendyolPackage.shipmentAddress?.district,
      cargoCompany: trendyolPackage.cargoCompany,
      trackingNo: trendyolPackage.cargoTrackingNumber,
      createdAt: trendyolPackage.createDateTime,
    };
  }

  /**
   * Birden çok Trendyol paketini MarketplaceOrder dizisine çevir.
   */
  static toMarketplaceOrders(trendyolPackages: TrendyolPackage[]): MarketplaceOrder[] {
    return trendyolPackages.map(pkg => this.toMarketplaceOrder(pkg));
  }

  /**
   * Trendyol API yanıtını parse et ve normalize et.
   */
  static parseOrdersResponse(apiResponse: any): {
    orders: MarketplaceOrder[];
    totalElements: number;
    totalPages: number;
    page: number;
  } {
    // Trendyol API yanıtı ya doğrudan content array ya da sayfalı yanıt döndürür
    let content: TrendyolPackage[] = [];
    let totalElements = 0;
    let totalPages = 0;
    let page = 0;

    if (apiResponse?.content) {
      // Sayfalı yanıt
      content = apiResponse.content;
      totalElements = apiResponse.totalElements || 0;
      totalPages = apiResponse.totalPages || 0;
      page = apiResponse.page || 0;
    } else if (Array.isArray(apiResponse)) {
      // Doğrudan dizi
      content = apiResponse;
      totalElements = apiResponse.length;
      totalPages = 1;
    }

    return {
      orders: this.toMarketplaceOrders(content),
      totalElements,
      totalPages,
      page,
    };
  }

  /**
   * Trendyol sipariş durumunu ortak duruma çevir.
   */
  static toOrderStatus(trendyolStatus: string): OrderStatus {
    return STATUS_MAP[trendyolStatus?.toUpperCase()] || 'pending';
  }

  /**
   * Ortak durumu Trendyol durumuna çevir.
   */
  static toTrendyolStatus(status: OrderStatus): string {
    return REVERSE_STATUS_MAP[status] || 'WAITING';
  }

  /**
   * Sipariş validasyonu.
   */
  static validate(order: any): string[] {
    const errors: string[] = [];
    if (!order?.orderNumber) errors.push('Order Number boş olamaz');
    if (!order?.id) errors.push('Package Id boş olamaz');
    if (!order?.customerInfo?.name && !order?.shipmentAddress?.fullName) errors.push('Customer bilgisi boş olamaz');
    if (!order?.status) errors.push('Status boş olamaz');
    if (order?.totalPrice !== undefined && order.totalPrice < 0) errors.push('Toplam tutar negatif olamaz');
    return errors;
  }

  /**
   * Sipariş tarihi için uygun format (ISO 8601).
   */
  static formatDate(date: Date): string {
    return date.toISOString();
  }
}
