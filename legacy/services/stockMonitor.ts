import { prisma } from '../db/prisma.ts';

/**
 * Stok Takip Servisi V2
 *
 * Bu servis aşağıdaki akışı otomatik olarak yönetir:
 *
 * Stok değişti
 *   ↓
 * Limit kontrolü (product.criticalStockLevel VEYA marketplace.criticalStockLevel)
 *   ↓
 * Limit altı ise → Aktif olduğu TÜM pazaryerlerinde SATIŞI KAPAT
 *   ↓
 * Log oluştur + Bildirim gönder
 *   ↓
 * Stok yükseldi (limit üstü) → Aktif olduğu TÜM pazaryerlerinde SATIŞI AÇ
 *   ↓
 * Log oluştur + Bildirim gönder
 */

interface ScanResult {
  scanned: number;
  closed: number;
  opened: number;
  noChange: number;
  marketplaceClosed: number;
  marketplaceOpened: number;
  errors: number;
  details: string[];
}

/**
 * Notification oluştur
 */
async function createNotification(type: string, title: string, message: string) {
  try {
    await prisma.notification.create({
      data: { type, title, message },
    });
  } catch (error) {
    console.error('[StockMonitor] Notification error:', error);
  }
}

/**
 * Audit log oluştur
 */
async function createAuditLog(productId: string, action: string, details: string) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: 'Product',
        entityId: productId,
        details,
        success: true,
      },
    });
  } catch (error) {
    console.error('[StockMonitor] AuditLog error:', error);
  }
}

/**
 * Belirli bir ürün için etkili kritik stok eşiğini bulur.
 * Öncelik sırası:
 * 1. Product.criticalStockLevel
 * 2. Product.minStock
 * 3. Bağlı olduğu marketplacelerin criticalStockLevel'ı
 * 4. 0 (her zaman kritik)
 */
async function getEffectiveThreshold(product: { id: string; stock: number; minStock: number; criticalStockLevel: number | null }): Promise<{ threshold: number; source: string }> {
  // 1. Ürün seviyesinde criticalStockLevel
  if (product.criticalStockLevel !== null && product.criticalStockLevel !== undefined) {
    return { threshold: product.criticalStockLevel, source: `urun-limiti:${product.criticalStockLevel}` };
  }

  // 2. minStock
  if (product.minStock > 0) {
    return { threshold: product.minStock, source: `min-stok:${product.minStock}` };
  }

  // 3. Marketplace seviyesinde criticalStockLevel
  try {
    const states = await prisma.productMarketplaceState.findMany({
      where: { productId: product.id },
      select: {
        marketplace: {
          select: { criticalStockLevel: true, name: true },
        },
      },
    });

    const marketplaceThresholds = states
      .map(s => s.marketplace.criticalStockLevel)
      .filter((l): l is number => l !== null && l !== undefined);

    if (marketplaceThresholds.length > 0) {
      const maxThreshold = Math.max(...marketplaceThresholds);
      return { threshold: maxThreshold, source: `pazaryeri-limiti:${maxThreshold}` };
    }
  } catch (error) {
    console.error('[StockMonitor] Marketplace threshold check error:', error);
  }

  // 4. Varsayılan: stok 0 ise kritik
  return { threshold: 0, source: 'varsayilan:0' };
}

/**
 * Ana stok tarama fonksiyonu.
 * autoStockManagement = true olan tüm ürünleri tarar.
 * Her ürün için:
 *   - Stok <= limit → TÜM aktif pazaryerlerinde satışı kapat
 *   - Stok > limit  → TÜM pazaryerlerinde satışı aç (önceden kapalıysa)
 */
export async function scanStockLevels(): Promise<ScanResult> {
  const result: ScanResult = {
    scanned: 0,
    closed: 0,
    opened: 0,
    noChange: 0,
    marketplaceClosed: 0,
    marketplaceOpened: 0,
    errors: 0,
    details: [],
  };

  const startTime = Date.now();

  // autoStockManagement = true olan ürünleri getir
  const products = await prisma.product.findMany({
    where: { autoStockManagement: true },
    select: {
      id: true,
      title: true,
      xmlKey: true,
      sku: true,
      stock: true,
      minStock: true,
      criticalStockLevel: true,
      status: true,
    },
  });

  result.scanned = products.length;
  console.log(`[StockMonitor] Tarama basladi: ${products.length} urun`);

  if (products.length === 0) {
    console.log('[StockMonitor] Tarama icin urun bulunamadi');
    return result;
  }

  // === OPTiMiZASYON: Toplu sorgu - N+1 yerine tek sorguda tüm state/marketplace bilgileri ===
  const productIds = products.map(p => p.id);

  // Tüm ürünlerin marketplace state'lerini tek sorguda çek
  const allStates = await prisma.productMarketplaceState.findMany({
    where: {
      productId: { in: productIds },
      marketplace: { active: true },
    },
    select: {
      id: true,
      productId: true,
      status: true,
      marketplaceId: true,
      marketplace: { select: { name: true, criticalStockLevel: true } },
    },
  });

  // productId -> states[] mapping
  const statesByProduct = new Map<string, typeof allStates>();
  for (const state of allStates) {
    const existing = statesByProduct.get(state.productId) || [];
    existing.push(state);
    statesByProduct.set(state.productId, existing);
  }

  // Tüm marketplace kritik stock seviyeleri (ürün bazlı değil)
  const marketplaceThresholds = new Map<string, number>();
  for (const state of allStates) {
    const level = state.marketplace.criticalStockLevel;
    if (level !== null) {
      const current = marketplaceThresholds.get(state.productId) || 0;
      if (level > current) {
        marketplaceThresholds.set(state.productId, level);
      }
    }
  }

  for (const product of products) {
    try {
      // === OPTiMiZASYON: Toplu threshold hesaplama ===
      let threshold: number;
      let source: string;

      if (product.criticalStockLevel !== null && product.criticalStockLevel !== undefined) {
        threshold = product.criticalStockLevel;
        source = `urun-limiti:${threshold}`;
      } else if (product.minStock > 0) {
        threshold = product.minStock;
        source = `min-stok:${threshold}`;
      } else {
        const mpThreshold = marketplaceThresholds.get(product.id);
        if (mpThreshold !== undefined) {
          threshold = mpThreshold;
          source = `pazaryeri-limiti:${threshold}`;
        } else {
          threshold = 0;
          source = 'varsayilan:0';
        }
      }

      const isCritical = product.stock <= threshold;

      // Durum değişikliği kontrolü
      const shouldBeStatus = isCritical ? 'PASSIVE' : 'READY';
      const needsStatusUpdate = product.status !== shouldBeStatus;

      if (needsStatusUpdate) {
        // Product.status güncelle
        await prisma.product.update({
          where: { id: product.id },
          data: {
            status: shouldBeStatus,
            lastStockCheckAt: new Date(),
            errorMessage: isCritical
              ? `Otomatik kapatildi: Stok ${product.stock}, esik ${threshold} (${source})`
              : null,
          },
        });

        if (isCritical) {
          result.closed++;
          const msg = `[StockMonitor] KAPATILDI: ${product.title || product.xmlKey} (stok:${product.stock}, esik:${threshold}, kaynak:${source})`;
          console.log(msg);
          result.details.push(msg);

          await createNotification(
            'STOCK_CRITICAL',
            `🔴 Stok Kritik: ${product.title || product.xmlKey}`,
            `Stok: ${product.stock}, Eşik: ${threshold}. Tüm pazaryerlerinde satış kapatıldı.`
          );
          await createAuditLog(product.id, 'STOCK_AUTO_CLOSE',
            `Stok kritik (${product.stock} <= ${threshold}). Kaynak: ${source}`);
        } else {
          result.opened++;
          const msg = `[StockMonitor] ACILDI: ${product.title || product.xmlKey} (stok:${product.stock}, esik:${threshold}, kaynak:${source})`;
          console.log(msg);
          result.details.push(msg);

          await createNotification(
            'STOCK_RESTORED',
            `🟢 Stok Düzeldi: ${product.title || product.xmlKey}`,
            `Stok: ${product.stock}, Eşik: ${threshold}. Tüm pazaryerlerinde satış açıldı.`
          );
          await createAuditLog(product.id, 'STOCK_AUTO_OPEN',
            `Stok düzeldi (${product.stock} > ${threshold}). Kaynak: ${source}`);
        }
      } else {
        result.noChange++;
      }

      // Tüm ProductMarketplaceState kayıtlarını güncelle (aktif pazaryerleri)
      const targetStatus = isCritical ? 'PASSIVE' : 'READY';
      const states = statesByProduct.get(product.id) || [];

      for (const state of states) {
        // Eğer durum zaten hedef durumdaysa atla
        if (state.status === targetStatus) continue;

        try {
          await prisma.productMarketplaceState.update({
            where: { id: state.id },
            data: {
              status: targetStatus,
              lastActionAt: new Date(),
              errorMessage: isCritical
                ? `Stok kritik (${product.stock} <= ${threshold}) - otomatik kapatildi`
                : null,
            },
          });

          if (isCritical) {
            result.marketplaceClosed++;
            console.log(`[StockMonitor]  -> Pazaryeri kapandi: ${state.marketplace.name}`);
          } else {
            result.marketplaceOpened++;
            console.log(`[StockMonitor]  -> Pazaryeri acildi: ${state.marketplace.name}`);
          }
        } catch (stateError) {
          console.error(`[StockMonitor] State update error for ${state.id}:`, stateError);
          result.errors++;
        }
      }

      // Son kontrol zamanını güncelle (eğer durum değişmediyse)
      if (!needsStatusUpdate && states.length === 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: { lastStockCheckAt: new Date() },
        });
      }
    } catch (productError) {
      console.error(`[StockMonitor] Product error ${product.id}:`, productError);
      result.errors++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[StockMonitor] Tarama tamam: ${duration}ms`);
  console.log(`[StockMonitor] Ozet: ${result.scanned} urun, ${result.closed} kapatildi, ${result.opened} acildi, ${result.marketplaceClosed} mp-kapandi, ${result.marketplaceOpened} mp-acildi, ${result.errors} hata`);

  return result;
}

/**
 * Tek bir ürünün stok durumunu kontrol et ve gerekirse güncelle
 */
export async function checkProductStock(productId: string): Promise<{
  productId: string;
  action: 'CLOSED' | 'OPENED' | 'NO_CHANGE' | 'SKIPPED';
  reason: string;
} | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      xmlKey: true,
      stock: true,
      minStock: true,
      criticalStockLevel: true,
      status: true,
      autoStockManagement: true,
    },
  });

  if (!product) return null;
  if (!product.autoStockManagement) {
    return { productId, action: 'SKIPPED', reason: 'Otomatik stok yönetimi kapalı' };
  }

  const { threshold, source } = await getEffectiveThreshold(product);
  const isCritical = product.stock <= threshold;

  if (isCritical && product.status !== 'PASSIVE') {
    // Stok kritik -> satisi kapat
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'PASSIVE', lastStockCheckAt: new Date() },
    });

    // Tüm marketplace state'lerini güncelle
    await prisma.productMarketplaceState.updateMany({
      where: { 
        productId: product.id,
        marketplace: { active: true },
        status: { not: 'PASSIVE' },
      },
      data: { status: 'PASSIVE', lastActionAt: new Date() },
    });

    await createAuditLog(productId, 'STOCK_AUTO_CLOSE',
      `Stok kritik (${product.stock} <= ${threshold}). Kaynak: ${source}`);

    return { productId, action: 'CLOSED', reason: `Stok ${product.stock} <= ${threshold} (${source})` };

  } else if (!isCritical && product.status === 'PASSIVE') {
    // Stok düzeldi -> satisi ac
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'READY', lastStockCheckAt: new Date(), errorMessage: null },
    });

    // Tüm marketplace state'lerini güncelle
    await prisma.productMarketplaceState.updateMany({
      where: { 
        productId: product.id,
        marketplace: { active: true },
        status: 'PASSIVE',
      },
      data: { status: 'READY', lastActionAt: new Date() },
    });

    await createAuditLog(productId, 'STOCK_AUTO_OPEN',
      `Stok düzeldi (${product.stock} > ${threshold}). Kaynak: ${source}`);

    return { productId, action: 'OPENED', reason: `Stok ${product.stock} > ${threshold} (${source})` };
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { lastStockCheckAt: new Date() },
  });

  return { productId, action: 'NO_CHANGE', reason: `Stok ${product.stock}, esik ${threshold} (${source})` };
}

/**
 * Alarm listesi: kritik stoktaki ürünler
 */
export async function getStockAlerts(limit = 50) {
  const products: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, title, xmlKey, sku, stock, minStock, "criticalStockLevel", status, "purchasePrice", "updatedAt"
    FROM Product
    WHERE ("autoStockManagement" = 1 OR "autoStockManagement" = true)
      AND stock <= COALESCE("criticalStockLevel", minStock, 0)
    ORDER BY stock ASC
    LIMIT ?
  `, limit);

  return products.map(p => ({
    ...p,
    isCritical: p.stock <= (p.criticalStockLevel ?? p.minStock ?? 0),
  }));
}

/**
 * Stok limiti ve autoStockManagement ayarlarını güncelle
 */
export async function updateStockConfig(
  productId: string,
  data: { criticalStockLevel?: number | null; autoStockManagement?: boolean; minStock?: number }
) {
  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.criticalStockLevel !== undefined ? { criticalStockLevel: data.criticalStockLevel } : {}),
      ...(data.autoStockManagement !== undefined ? { autoStockManagement: data.autoStockManagement } : {}),
      ...(data.minStock !== undefined ? { minStock: data.minStock } : {}),
    },
    select: {
      id: true,
      title: true,
      stock: true,
      minStock: true,
      criticalStockLevel: true,
      autoStockManagement: true,
      status: true,
    },
  });
}
