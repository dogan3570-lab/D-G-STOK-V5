import { prisma } from '../db/prisma.ts';

/**
 * Pazaryeri API entegrasyonları için temel servis
 * Trendyol, Hepsiburada, N11 entegrasyonları
 */

interface MarketplaceApiConfig {
  apiKey: string;
  apiSecret: string;
  apiUrl: string;
  sellerId?: string;
}

interface MarketplaceOrder {
  orderNo: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  city?: string;
  district?: string;
  cargoCompany?: string;
  trackingNo?: string;
  total: number;
  cargoPrice?: number;
  commission?: number;
  vat?: number;
  items?: string;
  status: string;
}

interface MarketplaceProduct {
  sku: string;
  barcode?: string;
  title: string;
  price: number;
  stock: number;
  description?: string;
  images?: string[];
  categoryId?: string;
  brand?: string;
}

/**
 * Pazaryeri API konfigürasyonunu al
 */
async function getMarketplaceConfig(marketplaceKey: string): Promise<MarketplaceApiConfig | null> {
  const marketplace = await prisma.marketplace.findUnique({
    where: { key: marketplaceKey },
  });

  if (!marketplace || !marketplace.apiKey || !marketplace.apiSecret) {
    return null;
  }

  return {
    apiKey: marketplace.apiKey,
    apiSecret: marketplace.apiSecret,
    apiUrl: marketplace.apiUrl || getDefaultApiUrl(marketplaceKey),
    sellerId: marketplace.settings ? JSON.parse(marketplace.settings).sellerId : undefined,
  };
}

/**
 * Varsayılan API URL'lerini döndür
 */
function getDefaultApiUrl(key: string): string {
  const urls: Record<string, string> = {
    trendyol: 'https://api.trendyol.com/sapigw',
    hepsiburada: 'https://api.hepsiburada.com',
    n11: 'https://api.n11.com',
    amazon: 'https://sellingpartnerapi.amazon.com',
    pt: 'https://api.pazarama.com',
  };
  return urls[key] || '';
}

/**
 * Trendyol API entegrasyonu
 */
export const trendyolApi = {
  /**
   * Siparişleri getir
   */
  async getOrders(config: MarketplaceApiConfig, status?: string): Promise<MarketplaceOrder[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('size', '100');

      const response = await fetch(`${config.apiUrl}/suppliers/${config.sellerId}/orders?${params}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Trendyol API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.content || []).map((order: any) => ({
        orderNo: String(order.orderNumber || ''),
        customerName: `${order.shipmentAddress?.firstName || ''} ${order.shipmentAddress?.lastName || ''}`.trim(),
        customerEmail: order.shipmentAddress?.email,
        customerPhone: order.shipmentAddress?.phone,
        address: order.shipmentAddress?.fullAddress,
        city: order.shipmentAddress?.city,
        district: order.shipmentAddress?.district,
        cargoCompany: order.cargoProviderName,
        trackingNo: order.cargoTrackingNumber,
        total: Number(order.totalPrice) || 0,
        cargoPrice: Number(order.cargoPrice) || 0,
        commission: Number(order.commission) || 0,
        vat: Number(order.vat) || 0,
        items: JSON.stringify(order.lines || []),
        status: mapTrendyolStatus(order.status),
      }));
    } catch (error) {
      console.error('[Trendyol] getOrders error:', error);
      return [];
    }
  },

  /**
   * Ürünleri gönder (listele)
   */
  async createProduct(config: MarketplaceApiConfig, product: MarketplaceProduct): Promise<boolean> {
    try {
      const body = {
        items: [{
          barcode: product.barcode || product.sku,
          title: product.title,
          productMainId: product.sku,
          brand: product.brand || '',
          categoryId: product.categoryId || 0,
          quantity: product.stock,
          stockCode: product.sku,
          dimensionalWeight: 1,
          description: product.description || '',
          currencyType: 'TRY',
          listPrice: product.price,
          salePrice: product.price,
          vatRate: 20,
          cargoCompanyId: 0,
          images: product.images?.map((url, i) => ({ url, order: i })) || [],
        }],
      };

      const response = await fetch(`${config.apiUrl}/suppliers/${config.sellerId}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error) {
      console.error('[Trendyol] createProduct error:', error);
      return false;
    }
  },

  /**
   * Stok güncelle
   */
  async updateStock(config: MarketplaceApiConfig, sku: string, quantity: number): Promise<boolean> {
    try {
      const body = {
        items: [{
          barcode: sku,
          quantity: quantity,
        }],
      };

      const response = await fetch(`${config.apiUrl}/suppliers/${config.sellerId}/products/price-and-inventory`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error) {
      console.error('[Trendyol] updateStock error:', error);
      return false;
    }
  },

  /**
   * Fiyat güncelle
   */
  async updatePrice(config: MarketplaceApiConfig, sku: string, price: number): Promise<boolean> {
    try {
      const body = {
        items: [{
          barcode: sku,
          salePrice: price,
        }],
      };

      const response = await fetch(`${config.apiUrl}/suppliers/${config.sellerId}/products/price-and-inventory`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error) {
      console.error('[Trendyol] updatePrice error:', error);
      return false;
    }
  },
};

/**
 * Hepsiburada API entegrasyonu
 */
export const hepsiburadaApi = {
  async getOrders(config: MarketplaceApiConfig, status?: string): Promise<MarketplaceOrder[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('pageSize', '100');

      const response = await fetch(`${config.apiUrl}/orders?${params}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Hepsiburada API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.data || []).map((order: any) => ({
        orderNo: String(order.orderNumber || ''),
        customerName: `${order.shippingAddress?.name || ''} ${order.shippingAddress?.surname || ''}`.trim(),
        customerEmail: order.shippingAddress?.email,
        customerPhone: order.shippingAddress?.phone,
        address: order.shippingAddress?.address,
        city: order.shippingAddress?.city,
        district: order.shippingAddress?.district,
        cargoCompany: order.cargoCompany,
        trackingNo: order.trackingNumber,
        total: Number(order.totalPrice) || 0,
        cargoPrice: Number(order.cargoPrice) || 0,
        commission: Number(order.commission) || 0,
        vat: Number(order.vat) || 0,
        items: JSON.stringify(order.items || []),
        status: mapHepsiburadaStatus(order.status),
      }));
    } catch (error) {
      console.error('[Hepsiburada] getOrders error:', error);
      return [];
    }
  },

  async updateStock(config: MarketplaceApiConfig, sku: string, quantity: number): Promise<boolean> {
    try {
      const response = await fetch(`${config.apiUrl}/products/${sku}/stock`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity }),
      });
      return response.ok;
    } catch (error) {
      console.error('[Hepsiburada] updateStock error:', error);
      return false;
    }
  },

  async updatePrice(config: MarketplaceApiConfig, sku: string, price: number): Promise<boolean> {
    try {
      const response = await fetch(`${config.apiUrl}/products/${sku}/price`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price }),
      });
      return response.ok;
    } catch (error) {
      console.error('[Hepsiburada] updatePrice error:', error);
      return false;
    }
  },
};

/**
 * N11 API entegrasyonu
 */
export const n11Api = {
  async getOrders(config: MarketplaceApiConfig, status?: string): Promise<MarketplaceOrder[]> {
    try {
      const response = await fetch(`${config.apiUrl}/ws/orderService`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <orderListRequest xmlns="http://www.n11.com/ws/schemas">
      <auth>
        <appKey>${config.apiKey}</appKey>
        <appSecret>${config.apiSecret}</appSecret>
      </auth>
      <status>${status || 'New'}</status>
    </orderListRequest>
  </soap:Body>
</soap:Envelope>`,
      });

      if (!response.ok) {
        throw new Error(`N11 API error: ${response.status}`);
      }

      const text = await response.text();
      // Basit XML parse - gerçek uygulamada daha detaylı parse gerekir
      const orders: MarketplaceOrder[] = [];
      
      // XML'den sipariş bilgilerini çıkar
      const orderRegex = /<order>([\s\S]*?)<\/order>/g;
      let match;
      while ((match = orderRegex.exec(text)) !== null) {
        const orderXml = match[1];
        orders.push({
          orderNo: extractXmlValue(orderXml, 'orderNumber'),
          customerName: extractXmlValue(orderXml, 'recipient'),
          customerEmail: extractXmlValue(orderXml, 'email'),
          customerPhone: extractXmlValue(orderXml, 'phone'),
          address: extractXmlValue(orderXml, 'address'),
          city: extractXmlValue(orderXml, 'city'),
          district: extractXmlValue(orderXml, 'district'),
          cargoCompany: extractXmlValue(orderXml, 'cargoCompany'),
          trackingNo: extractXmlValue(orderXml, 'trackingNumber'),
          total: Number(extractXmlValue(orderXml, 'totalAmount')) || 0,
          cargoPrice: Number(extractXmlValue(orderXml, 'cargoAmount')) || 0,
          commission: Number(extractXmlValue(orderXml, 'commission')) || 0,
          vat: Number(extractXmlValue(orderXml, 'vat')) || 0,
          items: extractXmlValue(orderXml, 'items'),
          status: extractXmlValue(orderXml, 'status') || 'new',
        });
      }

      return orders;
    } catch (error) {
      console.error('[N11] getOrders error:', error);
      return [];
    }
  },

  async updateStock(config: MarketplaceApiConfig, sku: string, quantity: number): Promise<boolean> {
    try {
      const response = await fetch(`${config.apiUrl}/ws/productService`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <updateStockRequest xmlns="http://www.n11.com/ws/schemas">
      <auth>
        <appKey>${config.apiKey}</appKey>
        <appSecret>${config.apiSecret}</appSecret>
      </auth>
      <productSku>${sku}</productSku>
      <quantity>${quantity}</quantity>
    </updateStockRequest>
  </soap:Body>
</soap:Envelope>`,
      });
      return response.ok;
    } catch (error) {
      console.error('[N11] updateStock error:', error);
      return false;
    }
  },
};

/**
 * Durum dönüşüm fonksiyonları
 */
function mapTrendyolStatus(status: string): string {
  const map: Record<string, string> = {
    'Created': 'new',
    'Picking': 'preparing',
    'Invoiced': 'processing',
    'Shipped': 'shipped',
    'Cancelled': 'cancelled',
    'Delivered': 'delivered',
    'UnDelivered': 'returned',
  };
  return map[status] || status?.toLowerCase() || 'new';
}

function mapHepsiburadaStatus(status: string): string {
  const map: Record<string, string> = {
    'New': 'new',
    'Preparing': 'preparing',
    'Shipped': 'shipped',
    'Delivered': 'delivered',
    'Cancelled': 'cancelled',
    'Returned': 'returned',
  };
  return map[status] || status?.toLowerCase() || 'new';
}

function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

/**
 * Tüm pazaryerlerinden siparişleri senkronize et
 */
export async function syncAllMarketplaceOrders(): Promise<number> {
  let totalOrders = 0;
  const marketplaces = await prisma.marketplace.findMany({ where: { active: true } });

  for (const mp of marketplaces) {
    try {
      const config = await getMarketplaceConfig(mp.key);
      if (!config) continue;

      let orders: MarketplaceOrder[] = [];

      switch (mp.key) {
        case 'tt':
        case 'trendyol':
          orders = await trendyolApi.getOrders(config);
          break;
        case 'he':
        case 'hepsiburada':
          orders = await hepsiburadaApi.getOrders(config);
          break;
        case 'n11':
          orders = await n11Api.getOrders(config);
          break;
      }

      // Siparişleri veritabanına kaydet
      for (const order of orders) {
        const existing = await prisma.order.findUnique({ where: { orderNo: order.orderNo } });
        if (!existing) {
          await prisma.order.create({
            data: {
              ...order,
              channel: mp.key,
              marketplaceId: mp.id,
            },
          });
          totalOrders++;
        }
      }
    } catch (error) {
      console.error(`[Marketplace] Sync error for ${mp.name}:`, error);
    }
  }

  return totalOrders;
}

/**
 * Pazaryeri API bağlantısını test et
 */
export async function testMarketplaceConnection(marketplaceId: string): Promise<{ ok: boolean; message: string }> {
  const marketplace = await prisma.marketplace.findUnique({ where: { id: marketplaceId } });
  if (!marketplace) {
    return { ok: false, message: 'Pazaryeri bulunamadı' };
  }

  const config = await getMarketplaceConfig(marketplace.key);
  if (!config) {
    return { ok: false, message: 'API anahtarları eksik' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(config.apiUrl, {
      signal: controller.signal,
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
      },
    });
    clearTimeout(timeout);

    const status = response.ok ? 'connected' : 'error';
    await prisma.marketplace.update({
      where: { id: marketplaceId },
      data: { apiStatus: status },
    });

    return {
      ok: response.ok,
      message: response.ok ? 'Bağlantı başarılı' : `HTTP ${response.status}`,
    };
  } catch (error) {
    await prisma.marketplace.update({
      where: { id: marketplaceId },
      data: { apiStatus: 'error' },
    });

    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Bağlantı hatası',
    };
  }
}
