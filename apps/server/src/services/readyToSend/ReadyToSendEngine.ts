// ==================== READY TO SEND ENGINE V1.0 ====================
// DG STOK V5.0 - Gönderime Hazır Merkezi
// TEK KARAR NOKTASI: Her ürün için tek JSON çıktı
// =====================================================================

import { prisma } from '../../db/prisma.ts';

export interface ProductReadiness {
  productId: string;
  ready: boolean;
  score: number;
  status: string;
  checks: {
    xml: boolean;
    category: boolean;
    brand: boolean;
    variant: boolean;
    listingTemplate: boolean;
    barcode: boolean;
    images: boolean;
    price: boolean;
    stock: boolean;
  };
  marketplaces: Array<{
    key: string;
    name: string;
    status: string;
    listingUrl?: string | null;
  }>;
  missing: string[];
}

export class ReadyToSendEngine {
  
  /**
   * Tek ürün için hazırlık kontrolü yapar
   * WorkflowState + Product verilerini birleştirir
   */
  static async checkProduct(productId: string): Promise<ProductReadiness> {
    const [product, ws, mpStates] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true, barcode: true, images: true, salePrice: true,
          stock: true, title: true, xmlKey: true,
        },
      }),
      prisma.workflowState.findUnique({ where: { productId } }),
      prisma.productMarketplaceState.findMany({
        where: { productId },
        include: { marketplace: { select: { key: true, name: true } } },
      }),
    ]);

    if (!product) {
      return {
        productId, ready: false, score: 0, status: 'NOT_FOUND',
        checks: { xml: false, category: false, brand: false, variant: false, listingTemplate: false, barcode: false, images: false, price: false, stock: false },
        marketplaces: [], missing: ['Ürün bulunamadı'],
      };
    }

    const missing: string[] = [];
    const checks = {
      xml: true,  // Product varsa XML var demektir
      category: ws ? ws.stepCategory === 'OK' : false,
      brand: ws ? ws.stepBrand === 'OK' : false,
      variant: ws ? ws.stepVariant === 'OK' : false,
      listingTemplate: ws ? ws.stepTitle === 'OK' : false,
      barcode: product.barcode !== null && product.barcode !== '',
      images: product.images !== null && product.images !== '',
      price: product.salePrice !== null && product.salePrice > 0,
      stock: (product.stock ?? 0) > 0,
    };

    if (!checks.xml) missing.push('XML kaynağı eksik');
    if (!checks.category) missing.push('Kategori eşleşmedi');
    if (!checks.brand) missing.push('Marka eşleşmedi');
    if (!checks.variant) missing.push('Varyant eşleşmedi');
    if (!checks.listingTemplate) missing.push('Listeleme şablonu eksik');
    if (!checks.barcode) missing.push('Barkod eksik');
    if (!checks.images) missing.push('Görsel eksik');
    if (!checks.price) missing.push('Satış fiyatı eksik');
    if (!checks.stock) missing.push('Stok tükendi');

    // Skor hesapla (100 üzerinden)
    const weights = { xml: 5, category: 15, brand: 15, variant: 15, listingTemplate: 20, barcode: 5, images: 10, price: 10, stock: 5 };
    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if ((checks as any)[key]) score += weight;
    }

    // Status belirle
    let status = 'READY';
    if (!checks.category) status = 'WAITING_CATEGORY';
    else if (!checks.brand) status = 'WAITING_BRAND';
    else if (!checks.variant) status = 'WAITING_VARIANT';
    else if (!checks.listingTemplate) status = 'WAITING_TEMPLATE';
    else if (!checks.barcode) status = 'WAITING_BARCODE';
    else if (!checks.images) status = 'WAITING_IMAGES';
    else if (!checks.price) status = 'WAITING_PRICE';
    else if (!checks.stock) status = 'WAITING_STOCK';

    // Marketplace durumları
    const marketplaces = mpStates.map(mps => ({
      key: mps.marketplace.key,
      name: mps.marketplace.name,
      status: mps.status,
      listingUrl: mps.listingUrl,
    }));

    return {
      productId,
      ready: missing.length === 0,
      score,
      status,
      checks,
      marketplaces,
      missing,
    };
  }

  /**
   * Hazır ürünleri listeler (sayfalanmış)
   */
  static async listReady(
    page = 1,
    limit = 50,
    filters?: { status?: string; search?: string; marketplaceId?: string }
  ): Promise<{ items: ProductReadiness[]; total: number }> {
    const where: any = {};
    if (filters?.status === 'ready') where.stepCategory = 'OK'; // WorkflowState filtre
    if (filters?.search) where.OR = [
      { product: { title: { contains: filters.search } } },
      { product: { xmlKey: { contains: filters.search } } },
    ];

    const [wsList, total] = await Promise.all([
      prisma.workflowState.findMany({
        where,
        orderBy: { readiness: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workflowState.count({ where }),
    ]);

    const items = await Promise.all(
      wsList.map(ws => this.checkProduct(ws.productId))
    );

    return { items, total };
  }
}
