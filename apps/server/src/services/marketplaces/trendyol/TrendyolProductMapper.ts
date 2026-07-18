// ==================== TRENDYOL ÜRÜN MAPPER V1.0 ====================
// Ortak ürün modeli ↔ Trendyol API formatı dönüşümü.
// 
// Avantajları:
// - XML ürün modeli ↔ Trendyol veri modeli ayrılır
// - Aynı ürün modeli Hepsiburada, N11, Amazon'a da dönüştürülebilir
// - Adapter daha sade ve bakımı kolay olur
// ================================================================

import { MarketplaceProduct } from '../core/MarketplaceTypes.ts';
import { CorrelationId } from '../../eventBus/events.ts';

/** Trendyol ürün item'ı (API'ye gönderilecek format) */
export interface TrendyolProductItem {
  barcode: string;
  title: string;
  productMainId: string;
  brandId: number;
  categoryId: number;
  quantity: number;
  stockCode: string;
  dimensionalWeight: number;
  description: string;
  currencyType: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  cargoCompanyId: number;
  images: TrendyolProductImage[];
  attributes: TrendyolProductAttribute[];
  variants?: TrendyolProductVariant[];
}

export interface TrendyolProductImage {
  url: string;
}

export interface TrendyolProductAttribute {
  attributeId: number;
  attributeValueId?: number;
  customAttributeValue?: string;
}

export interface TrendyolProductVariant {
  barcode: string;
  title: string;
  quantity: number;
  stockCode: string;
  salePrice: number;
  listPrice: number;
  attributes: TrendyolProductAttribute[];
}

/** Trendyol stok güncelleme item'ı */
export interface TrendyolStockItem {
  barcode: string;
  quantity: number;
}

/** Trendyol fiyat güncelleme item'ı */
export interface TrendyolPriceItem {
  barcode: string;
  salePrice: number;
  listPrice?: number;
}

/** Trendyol ürün gönderme request body */
export interface TrendyolProductRequest {
  items: TrendyolProductItem[];
}

/** Trendyol stok güncelleme request body */
export interface TrendyolStockRequest {
  items: TrendyolStockItem[];
}

/** Trendyol fiyat güncelleme request body */
export interface TrendyolPriceRequest {
  items: TrendyolPriceItem[];
}

/**
 * Trendyol Ürün Mapper
 * 
 * Ortak MarketplaceProduct modelini Trendyol API formatına çevirir.
 * 
 * Kullanım:
 * ```typescript
 * const trendyolProduct = TrendyolProductMapper.toProductItem(product);
 * const requestBody = TrendyolProductMapper.toProductRequest([product]);
 * ```
 */
export class TrendyolProductMapper {
  /**
   * Tek bir ürünü Trendyol product item'ına çevir
   */
  static toProductItem(
    product: MarketplaceProduct,
    options: {
      brandId: number;
      categoryId: number;
      vatRate?: number;
      cargoCompanyId?: number;
      currencyType?: string;
      dimensionalWeight?: number;
    }
  ): TrendyolProductItem {
    const listPrice = product.price * 1.2; // %20 marj varsayılan
    const salePrice = product.price;

    return {
      barcode: product.barcode || product.sku,
      title: product.title,
      productMainId: product.sku,
      brandId: options.brandId,
      categoryId: options.categoryId,
      quantity: product.stock,
      stockCode: product.sku,
      dimensionalWeight: options.dimensionalWeight || 1,
      description: product.description || '',
      currencyType: options.currencyType || 'TRY',
      listPrice: Math.round(listPrice * 100) / 100,
      salePrice: Math.round(salePrice * 100) / 100,
      vatRate: options.vatRate || 20,
      cargoCompanyId: options.cargoCompanyId || 0,
      images: this.toImages(product.images),
      attributes: this.toAttributes(product.attributes),
      variants: product.variants?.map(v => ({
        barcode: v.barcode || v.sku,
        title: v.title || '',
        quantity: v.stock ?? product.stock,
        stockCode: v.sku,
        salePrice: v.price ?? salePrice,
        listPrice: v.price ? v.price * 1.2 : listPrice,
        attributes: this.toAttributes(v.attributes),
      })),
    };
  }

  /**
   * Birden çok ürünü Trendyol request body'sine çevir
   */
  static toProductRequest(products: TrendyolProductItem[]): TrendyolProductRequest {
    return { items: products };
  }

  /**
   * Stok güncelleme request body'si oluştur
   */
  static toStockRequest(items: TrendyolStockItem[]): TrendyolStockRequest {
    return { items };
  }

  /**
   * Fiyat güncelleme request body'si oluştur
   */
  static toPriceRequest(items: TrendyolPriceItem[]): TrendyolPriceRequest {
    return { items };
  }

  /**
   * Tek stok item'ı oluştur
   */
  static toStockItem(barcode: string, quantity: number): TrendyolStockItem {
    return { barcode, quantity };
  }

  /**
   * Tek fiyat item'ı oluştur
   */
  static toPriceItem(barcode: string, salePrice: number, listPrice?: number): TrendyolPriceItem {
    return { barcode, salePrice, listPrice };
  }

  /**
   * Görselleri Trendyol formatına çevir
   */
  private static toImages(images?: string[]): TrendyolProductImage[] {
    if (!images || images.length === 0) return [];
    return images.map(url => ({ url }));
  }

  /**
   * Attribute'ları Trendyol formatına çevir
   * 
   * NOT: Attribute ID'leri Trendyol'dan alınmalıdır.
   * Bu mapper sadece customAttributeValue destekler.
   * Gerçek attribute ID'leri için Trendyol attribute API'i çağrılmalıdır.
   */
  private static toAttributes(attributes?: Record<string, string>): TrendyolProductAttribute[] {
    if (!attributes) return [];
    return Object.entries(attributes).map(([key, value]) => ({
      attributeId: 0, // Attribute ID bilinmiyorsa 0
      customAttributeValue: `${key}: ${value}`,
    }));
  }

  /**
   * Ürün validasyonu - zorunlu alanları kontrol et
   */
  static validate(product: MarketplaceProduct): string[] {
    const errors: string[] = [];

    if (!product.sku) errors.push('SKU zorunludur');
    if (!product.barcode && !product.sku) errors.push('Barkod veya SKU zorunludur');
    if (!product.title) errors.push('Ürün başlığı (title) zorunludur');
    if (!product.price || product.price <= 0) errors.push('Geçerli satış fiyatı (price) zorunludur');
    if (product.stock === undefined || product.stock < 0) errors.push('Geçerli stok miktarı (stock) zorunludur');

    return errors;
  }
}
