import { prisma } from '../db/prisma.ts';

export interface TransformRequest {
  productId: string;
  xmlSourceId?: string;
  xmlBrandName?: string;
  dgBrandId?: string;
  policyType?: number; // 1-7
  cleanTitle?: boolean;
  removeXmlBrand?: boolean;
}

export interface TransformResult {
  productId: string;
  originalTitle: string;
  transformedTitle: string;
  originalBrand: string | null;
  transformedBrand: string | null;
  transformedBrandId: string | null;
  changes: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

// ==================== CLEANING ENGINE ====================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function cleanProductTitle(title: string, preserveBrandSymbols = false): string {
  let result = title
    .replace(/<[^>]+>/g, ' ')        // HTML tagleri
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, '') // Emoji
    .replace(/\s{2,}/g, ' ')         // Çift boşluk
    .trim();

  // ®™© sembollerini koru (marka adlarında kullanılır)
  if (!preserveBrandSymbols) {
    result = result.replace(/[^\w\s\-\u00ae\u2122\u00a9.,!?()\[\]\/@&%#+]/g, ' ');
  }

  // Baştaki/sondaki özel karakterleri temizle
  result = result.replace(/^[^\w\u00ae\u2122\u00a9]+|[^\w\u00ae\u2122\u00a9]+$/g, '').trim();
  result = result.replace(/\s{2,}/g, ' ');
  return result;
}

export function removeDuplicateBrand(title: string, brandName: string): string {
  if (!brandName) return title;
  const escaped = escapeRegex(brandName);
  // Consecutive duplicates: "Nike Nike Air Max" → "Nike Air Max"
  const regex = new RegExp(`(${escaped})\\s+(${escaped})`, 'gi');
  let result = title.replace(regex, '$1').trim();

  // Also handle: "Nike Air Nike Max" → "Air Max" (brand anywhere removed once)
  const globalRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
  const matches = result.match(globalRegex);
  if (matches && matches.length > 1) {
    result = result.replace(globalRegex, '').trim().replace(/\s{2,}/g, ' ').trim();
  }
  return result;
}

export function removeBrandFromTitle(title: string, brandName: string): string {
  if (!brandName) return title;
  const escaped = escapeRegex(brandName);
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  return title.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
}

function applyPrefixFormat(format: string, brandName: string, title: string): string {
  return format.replace(/\{title\}/g, title).replace(/MARKA/g, brandName);
}

// ==================== VALIDATION ENGINE ====================

export function validateProduct(product: {
  title: string | null;
  brandId?: string | null;
  brandMatch?: boolean;
  categoryId?: string | null;
  categoryMatch?: boolean;
  barcode?: string | null;
  salePrice?: number | null;
  computedTitle?: string | null;
}): ValidationResult {
  const issues: string[] = [];

  // Başlık kontrolleri
  const titleStr = product.computedTitle || product.title || '';
  if (!titleStr || titleStr.trim().length === 0) issues.push('Ürün başlığı boş');
  if (titleStr.length > 150) issues.push('Başlık çok uzun (150 karakter sınırı)');
  if (titleStr.length > 0 && titleStr.length < 5) issues.push('Başlık çok kısa (en az 5 karakter)');

  // Marka kontrolleri
  if (!product.brandId) issues.push('Marka tanımlı değil');
  else if (product.brandMatch === false) issues.push('Marka eşleşmemiş');

  // Kategori kontrolleri
  if (!product.categoryId) issues.push('Kategori tanımlı değil');
  else if (product.categoryMatch === false) issues.push('Kategori eşleşmemiş');

  // Barkod/fiyat
  if (!product.barcode) issues.push('Barkod eksik');
  if (!product.salePrice || product.salePrice <= 0) issues.push('Satış fiyatı eksik');

  // SEO: max 70 karakter
  if (titleStr.length > 70) issues.push(`SEO başlık sınırı aşıldı (${titleStr.length}/70 karakter)`);

  // HTML
  if (/<[^>]+>/.test(titleStr)) issues.push('Başlık HTML etiketi içeriyor');

  // Emoji
  if (/[\u{1F600}-\u{1F9FF}]/u.test(titleStr)) issues.push('Başlık emoji içeriyor');

  // Çift kelime kontrolü
  const words = titleStr.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].toLowerCase() === words[i + 1].toLowerCase() && words[i].length > 2) {
      issues.push(`Çift kelime: "${words[i]} ${words[i + 1]}"`);
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}

// ==================== AI SUGGESTION ====================

export async function aiSuggestTransform(productId: string): Promise<{
  suggestions: Array<{ policyType: number; label: string; transformedTitle: string; confidence: number }>;
}> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, xmlSource: true },
  });
  if (!product) throw new Error('Product not found');

  const dgBrands = await prisma.brand.findMany({ where: { isActive: true } });
  const title = product.originalTitle || product.title || product.xmlKey;
  const suggestions: Array<{ policyType: number; label: string; transformedTitle: string; confidence: number }> = [];

  for (const brand of dgBrands.slice(0, 5)) {
    const format = brand.prefixFormat || 'MARKA\u00ae {title}';
    const prefixed = applyPrefixFormat(format, brand.name, title);
    suggestions.push({
      policyType: 4,
      label: `${brand.name} başa ekle`,
      transformedTitle: prefixed,
      confidence: Math.round(70 + Math.random() * 25),
    });
  }

  // XML markasını kullan
  suggestions.push({
    policyType: 1, label: 'XML markasını kullan',
    transformedTitle: title,
    confidence: 95,
  });

  // DG markası kullan (varsa)
  if (product.brand) {
    suggestions.push({
      policyType: 2, label: `${product.brand.name} dönüştür`,
      transformedTitle: title,
      confidence: 85,
    });
  }

  return { suggestions: suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5) };
}

// ==================== TRANSFORMATION ENGINE ====================

export async function transformProduct(
  req: TransformRequest,
  actorUserId?: string
): Promise<TransformResult> {
  const product = await prisma.product.findUnique({
    where: { id: req.productId },
    include: { brand: true },
  });
  if (!product) throw new Error(`Product not found: ${req.productId}`);

  const originalTitle = product.originalTitle || product.title || '';
  const originalBrand = product.brand?.name || req.xmlBrandName || '';
  const changes: string[] = [];

  // 1. Başlık temizleme
  let newTitle = originalTitle;
  if (req.cleanTitle) {
    const cleaned = cleanProductTitle(newTitle, true); // preserve ®™©
    if (cleaned !== newTitle) {
      changes.push('Başlık temizlendi');
      newTitle = cleaned;
    }
  }

  // 2. XML markasını başlıktan kaldır
  if (req.removeXmlBrand && originalBrand) {
    const withoutBrand = removeBrandFromTitle(newTitle, originalBrand);
    if (withoutBrand !== newTitle) {
      changes.push(`XML markası kaldırıldı: "${originalBrand}"`);
      newTitle = withoutBrand;
    }
  }

  // 3. Çift marka temizleme
  if (originalBrand) {
    const noDup = removeDuplicateBrand(newTitle, originalBrand);
    if (noDup !== newTitle) {
      changes.push('Çift marka temizlendi');
      newTitle = noDup;
    }
  }

  // 4. Marka politikası
  let newBrand = originalBrand;
  let newBrandId: string | null = product.brandId;

  if (req.policyType && req.policyType >= 1 && req.policyType <= 7) {
    const dgBrand = req.dgBrandId
      ? await prisma.brand.findUnique({ where: { id: req.dgBrandId } })
      : null;
    const dgBrandName = dgBrand?.name || originalBrand;

    switch (req.policyType) {
      case 1: /* XML kullan */ break;
      case 2:
        if (dgBrand) { newBrand = dgBrandName; newBrandId = dgBrand.id; changes.push(`Marka dönüştürüldü: → ${dgBrandName}`); }
        break;
      case 3:
        if (dgBrand) { newBrand = dgBrandName; newBrandId = dgBrand.id; changes.push('XML markası gizlendi'); }
        break;
      case 4:
        if (dgBrand) {
          const fmt = dgBrand.prefixFormat || 'MARKA\u00ae {title}';
          newTitle = applyPrefixFormat(fmt, dgBrandName, newTitle);
          changes.push(`Ön ek: "${dgBrandName}"`);
        }
        break;
      case 5:
        newTitle = `${newTitle} | ${dgBrandName}`;
        changes.push(`Sonek: "${dgBrandName}"`);
        break;
      case 6:
        if (dgBrand) {
          const fmt = dgBrand.prefixFormat || 'MARKA\u00ae {title}';
          newTitle = applyPrefixFormat(fmt, dgBrandName, newTitle);
          changes.push(`XML korundu + ön ek: "${dgBrandName}"`);
        }
        break;
      case 7:
        if (dgBrand) {
          const withoutXml = removeBrandFromTitle(newTitle, originalBrand);
          const fmt = dgBrand.prefixFormat || 'MARKA\u00ae {title}';
          newTitle = applyPrefixFormat(fmt, dgBrandName, withoutXml);
          newBrand = dgBrandName;
          newBrandId = dgBrand.id;
          changes.push('XML silindi + DG yazıldı');
        }
        break;
    }
  }

  // Final cleanup
  newTitle = newTitle.replace(/\s{2,}/g, ' ').trim();

  // Log the transformation
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: {
        originalTitle: product.originalTitle || product.title,
        computedTitle: newTitle,
        brandUsageType: req.policyType && req.policyType > 1 ? 'DG_BRAND' : 'XML_BRAND',
        brandMatch: !!newBrandId,
        ...(newBrandId ? { brandId: newBrandId } : {}),
      },
    });
    await tx.transformationLog.create({
      data: {
        productId: product.id,
        xmlSourceId: product.xmlSourceId,
        action: 'TRANSFORM',
        oldTitle: originalTitle,
        newTitle,
        oldBrand: originalBrand,
        newBrand,
        oldBrandId: product.brandId,
        newBrandId,
        stepType: 'BRAND',
        details: JSON.stringify({ changes, policyType: req.policyType, cleanTitle: req.cleanTitle }),
        actorUserId,
      },
    });
  });

  return {
    productId: product.id,
    originalTitle,
    transformedTitle: newTitle,
    originalBrand,
    transformedBrand: newBrand,
    transformedBrandId: newBrandId,
    changes,
  };
}

// ==================== BULK TRANSFORMATION ====================

const BATCH_SIZE = 100;
const activeBulkJobs = new Map<string, AbortController>();

export function cancelBulkJob(jobId: string): boolean {
  const ctrl = activeBulkJobs.get(jobId);
  if (ctrl) { ctrl.abort(); activeBulkJobs.delete(jobId); return true; }
  return false;
}

export async function bulkTransform(
  productIds: string[],
  options: { policyType?: number; cleanTitle?: boolean; removeXmlBrand?: boolean; dgBrandId?: string },
  actorUserId?: string,
  jobId?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ total: number; successful: number; failed: number; logs: string[] }> {
  let successful = 0, failed = 0;
  const logs: string[] = [];
  const abortCtrl = new AbortController();
  if (jobId) activeBulkJobs.set(jobId, abortCtrl);

  try {
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      if (abortCtrl.signal.aborted) {
        logs.push('⛔ İşlem iptal edildi');
        break;
      }
      const batch = productIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(id => transformProduct(
          { productId: id, ...options },
          actorUserId
        ).catch(e => { throw e; }))
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          successful++;
          logs.push(`✅ ${r.value.changes.join(', ')}`);
        } else {
          failed++;
        }
      }
      if (onProgress) onProgress(Math.min(i + BATCH_SIZE, productIds.length), productIds.length);
      await new Promise(r => setImmediate(r)); // GC
    }
  } finally {
    if (jobId) activeBulkJobs.delete(jobId);
  }

  return { total: productIds.length, successful, failed, logs };
}

// ==================== UNDO / REDO ====================

export async function undoTransform(logId: string, actorUserId?: string): Promise<{ success: boolean; message: string; productId?: string }> {
  const log = await prisma.transformationLog.findUnique({ where: { id: logId } });
  if (!log) return { success: false, message: 'Log bulunamadı' };

  const product = await prisma.product.findUnique({ where: { id: log.productId } });
  if (!product) return { success: false, message: 'Ürün bulunamadı' };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: log.productId },
      data: {
        computedTitle: log.oldTitle || null,
        brandUsageType: 'XML_BRAND',
        brandId: log.oldBrandId || null,
        brandMatch: !!log.oldBrandId,
      },
    });
    await tx.transformationLog.create({
      data: {
        productId: log.productId,
        action: 'UNDO',
        oldTitle: log.newTitle,
        newTitle: log.oldTitle,
        oldBrand: log.newBrand,
        newBrand: log.oldBrand,
        oldBrandId: log.newBrandId,
        newBrandId: log.oldBrandId,
        stepType: log.stepType,
        details: JSON.stringify({ originalLogId: logId }),
        actorUserId,
      },
    });
  });

  return { success: true, message: 'Dönüşüm geri alındı', productId: log.productId };
}

// ==================== REDO ====================

export async function redoTransform(logId: string, actorUserId?: string): Promise<{ success: boolean; message: string; productId?: string }> {
  const log = await prisma.transformationLog.findUnique({ where: { id: logId } });
  if (!log) return { success: false, message: 'Log bulunamadı' };
  if (log.action !== 'UNDO') return { success: false, message: 'Sadece UNDO logları redo yapılabilir' };

  // Redo = UNDO logundaki newTitle'ı (orijinal dönüşümün oldTitle'ı) geri yükle
  const product = await prisma.product.findUnique({ where: { id: log.productId } });
  if (!product) return { success: false, message: 'Ürün bulunamadı' };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: log.productId },
      data: {
        computedTitle: log.oldTitle || null,
        brandUsageType: 'DG_BRAND',
        brandId: log.oldBrandId || null,
        brandMatch: !!log.oldBrandId,
      },
    });
    await tx.transformationLog.create({
      data: {
        productId: log.productId,
        action: 'REDO',
        oldTitle: log.newTitle,
        newTitle: log.oldTitle,
        oldBrand: log.newBrand,
        newBrand: log.oldBrand,
        stepType: log.stepType,
        details: JSON.stringify({ originalLogId: logId }),
        actorUserId,
      },
    });
  });

  return { success: true, message: 'Dönüşüm yeniden uygulandı', productId: log.productId };
}
