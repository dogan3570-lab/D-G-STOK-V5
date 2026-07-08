import { prisma } from '../db/prisma.ts';

export type XmlImportResult = {
  ok: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount?: number;
  failedCount?: number;
  items: Array<{ xmlKey: string; created: boolean; matchedBy?: 'xmlKey' | 'sku'; outcome?: string; errorDetail?: string }>;
  error?: { code: string; message: string };
  runId?: string;
};

export type XmlImportProduct = {
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number;
  price: number | null;
  listPrice: number | null;
  tax: number | null;
  currency: string | null;
  brand: string | null;
  category: string | null;
  mainCategory: string | null;
  topCategory: string | null;
  subCategory: string | null;
  description: string | null;
  detail: string | null;
  images: string | null;
  link: string | null;
  unit: string | null;
  active: boolean;
};

function parseXmlDocument(xml: string) {
  const source = xml?.trim() ?? '';
  if (!source) {
    return { ok: false as const, error: 'Empty XML payload' };
  }

  const tagRegex = /<!--([\s\S]*?)-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[^>]*\?>|<!DOCTYPE[\s\S]*?>|<\/?([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>/g;
  const stack: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(source)) !== null) {
    const fullTag = match[0];
    if (fullTag.startsWith('<!--') || fullTag.startsWith('<![') || fullTag.startsWith('<?') || fullTag.startsWith('<!DOCTYPE')) {
      continue;
    }

    if (fullTag.startsWith('</')) {
      const tagName = match[3]?.toLowerCase();
      if (!tagName) {
        return { ok: false as const, error: 'Invalid XML: malformed closing tag' };
      }

      if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
        return { ok: false as const, error: `Invalid XML: mismatched closing tag ${tagName}` };
      }

      stack.pop();
      continue;
    }

    if (fullTag.endsWith('/>')) {
      continue;
    }

    const tagName = match[3]?.toLowerCase();
    if (!tagName) {
      return { ok: false as const, error: 'Invalid XML: malformed opening tag' };
    }

    stack.push(tagName);
  }

  if (stack.length > 0) {
    return { ok: false as const, error: `Invalid XML: unclosed tag ${stack[stack.length - 1]}` };
  }

  return { ok: true as const, source };
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/"/gi, '"');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '));
}

function extractTagValue(content: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(content);
  if (!match) return null;
  
  // Önce CDATA içeriğini çıkar
  let value = match[1];
  const cdataMatch = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) {
    value = cdataMatch[1];
  } else {
    value = stripTags(value);
  }
  
  return normalizeText(value);
}

export function parseXmlImportPayload(xml: string): XmlImportProduct[] {
  const parsed = parseXmlDocument(xml);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const productRegex = /<(product|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = Array.from(parsed.source.matchAll(productRegex));

  if (matches.length === 0) {
    return [];
  }

  return matches
    .map((match) => {
      const content = match[2] ?? '';

      // XML'deki alanları dene - önce standart alanlar, sonra alternatifler
      const xmlKey = extractTagValue(content, 'xmlKey') || extractTagValue(content, 'id');
      if (!xmlKey) return null;

      const title = extractTagValue(content, 'title') || extractTagValue(content, 'name');
      const sku = extractTagValue(content, 'sku') || extractTagValue(content, 'productCode') || extractTagValue(content, 'modelCode');
      const barcode = extractTagValue(content, 'barcode');
      const stockValue = extractTagValue(content, 'stock') || extractTagValue(content, 'quantity');
      const minStockValue = extractTagValue(content, 'minStock');
      const priceValue = extractTagValue(content, 'price') || extractTagValue(content, 'listPrice');
      const listPriceValue = extractTagValue(content, 'listPrice');
      const taxValue = extractTagValue(content, 'tax');
      const currency = extractTagValue(content, 'currency');
      const brand = extractTagValue(content, 'brand');
      const category = extractTagValue(content, 'category');
      const mainCategory = extractTagValue(content, 'main_category');
      const topCategory = extractTagValue(content, 'top_category');
      const subCategory = extractTagValue(content, 'sub_category');
      const description = extractTagValue(content, 'description');
      const detail = extractTagValue(content, 'detail');
      const link = extractTagValue(content, 'link');
      const unit = extractTagValue(content, 'unit');
      const activeValue = extractTagValue(content, 'active');

      // Resimleri topla - image1, image2, image3... ve ayrıca images, picture, resim tag'lerini de dene
      const images: string[] = [];
      
      // Önce images tag'ini dene (virgülle ayrılmış URL'ler)
      const imagesTag = extractTagValue(content, 'images') || extractTagValue(content, 'pictures') || extractTagValue(content, 'resimler');
      if (imagesTag) {
        imagesTag.split(',').forEach(img => {
          const trimmed = img.trim();
          if (trimmed && trimmed.startsWith('http')) images.push(trimmed);
        });
      }
      
      // image1, image2, image3... tag'lerini dene
      for (let i = 1; i <= 10; i++) {
        const img = extractTagValue(content, `image${i}`) || extractTagValue(content, `picture${i}`) || extractTagValue(content, `resim${i}`);
        if (img && img.startsWith('http')) images.push(img);
      }
      
      // image, picture, resim tag'lerini dene (tekli)
      if (images.length === 0) {
        const singleImg = extractTagValue(content, 'image') || extractTagValue(content, 'picture') || extractTagValue(content, 'resim') || extractTagValue(content, 'img') || extractTagValue(content, 'gorsel');
        if (singleImg && singleImg.startsWith('http')) images.push(singleImg);
      }
      
      // Ayrıca <image> içinde <url> alt tag'i olabilir
      if (images.length === 0) {
        const imageUrlRegex = /<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>[\s\S]*?<\/image>/gi;
        const urlMatches = Array.from(content.matchAll(imageUrlRegex));
        urlMatches.forEach(m => {
          const url = m[1]?.trim();
          if (url && url.startsWith('http')) images.push(url);
        });
      }
      
      // Son çare: içerikteki tüm http linklerini tara
      if (images.length === 0) {
        const urlRegex = /(https?:\/\/[^\s"'<>]+(?:jpg|jpeg|png|gif|webp|bmp))/gi;
        const urlMatches = Array.from(content.matchAll(urlRegex));
        urlMatches.forEach(m => {
          const url = m[1]?.trim();
          if (url && !images.includes(url)) images.push(url);
        });
      }

      return {
        xmlKey,
        title,
        sku,
        barcode,
        stock: Number.parseInt(stockValue ?? '0', 10),
        minStock: Number.parseInt(minStockValue ?? '0', 10),
        price: priceValue ? Number.parseFloat(priceValue) : null,
        listPrice: listPriceValue ? Number.parseFloat(listPriceValue) : null,
        tax: taxValue ? Number.parseFloat(taxValue) : null,
        currency: currency || null,
        brand: brand || null,
        category: category || null,
        mainCategory: mainCategory || null,
        topCategory: topCategory || null,
        subCategory: subCategory || null,
        description: description || null,
        detail: detail || null,
        images: images.length > 0 ? images.join(',') : null,
        link: link || null,
        unit: unit || null,
        active: activeValue === '1',
      } satisfies XmlImportProduct;
    })
    .filter((item): item is XmlImportProduct => item != null);
}

// Kategori adına göre sistemde ara, bulamazsa oluştur
async function findOrCreateCategory(categoryName: string | null): Promise<{ id: string | null; matched: boolean }> {
  if (!categoryName) return { id: null, matched: false };
  
  const normalized = categoryName.trim();
  if (!normalized) return { id: null, matched: false };

  // Önce tam eşleşme ara
  let category = await prisma.category.findUnique({ where: { name: normalized } });
  if (category) return { id: category.id, matched: true };

  // Büyük/küçük harf duyarsız ara
  category = await prisma.category.findFirst({
    where: { name: { contains: normalized } },
  });
  if (category) return { id: category.id, matched: true };

  // Bulamazsa otomatik oluştur
  try {
    category = await prisma.category.create({
      data: { name: normalized },
    });
    return { id: category.id, matched: true };
  } catch {
    return { id: null, matched: false };
  }
}

// Marka adına göre sistemde ara, bulamazsa oluştur
async function findOrCreateBrand(brandName: string | null): Promise<{ id: string | null; matched: boolean }> {
  if (!brandName) return { id: null, matched: false };
  
  const normalized = brandName.trim();
  if (!normalized) return { id: null, matched: false };

  // Önce tam eşleşme ara
  let brand = await prisma.brand.findUnique({ where: { name: normalized } });
  if (brand) return { id: brand.id, matched: true };

  // Büyük/küçük harf duyarsız ara
  brand = await prisma.brand.findFirst({
    where: { name: { contains: normalized } },
  });
  if (brand) return { id: brand.id, matched: true };

  // Bulamazsa otomatik oluştur
  try {
    brand = await prisma.brand.create({
      data: { name: normalized },
    });
    return { id: brand.id, matched: true };
  } catch {
    return { id: null, matched: false };
  }
}

export async function importXmlProducts(xml: string, options?: { actorUserId?: string | null; sourceName?: string | null; sourceId?: string | null }) {
  const parsed = parseXmlDocument(xml);
  if (!parsed.ok) {
    return { ok: false, error: { code: 'INVALID_XML', message: parsed.error }, importedCount: 0, updatedCount: 0, items: [] } satisfies XmlImportResult;
  }

  const items = parseXmlImportPayload(xml);

  if (items.length === 0) {
    return { ok: true, importedCount: 0, updatedCount: 0, skippedCount: 0, items: [] } satisfies XmlImportResult;
  }

  let sourceRecord = null as Awaited<ReturnType<typeof prisma.xmlSource.findFirst>> | null;
  if (options?.sourceId) {
    sourceRecord = await prisma.xmlSource.findUnique({ where: { id: options.sourceId } });
  } else if (options?.sourceName) {
    sourceRecord = await prisma.xmlSource.findFirst({ where: { name: options.sourceName } });
  }

  const run = await prisma.xmlImportRun.create({
    data: {
      sourceId: sourceRecord?.id ?? (await prisma.xmlSource.create({ data: { name: options?.sourceName ?? 'manual-import', sourceType: 'MANUAL', active: true, scheduleIntervalMinutes: 60 } })).id,
      status: 'running',
      totalProducts: items.length,
    },
  });

  const results = [] as Array<{ xmlKey: string; created: boolean; matchedBy?: 'xmlKey' | 'sku'; outcome: string; errorDetail?: string }>;
  let failedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const existingByXmlKey = item.xmlKey
      ? await prisma.product.findUnique({ where: { xmlKey: item.xmlKey } })
      : null;

    const existingBySku = item.sku && !existingByXmlKey
      ? await prisma.product.findFirst({ where: { sku: item.sku } })
      : null;

    const existing = existingByXmlKey ?? existingBySku;

    // Kategori ve marka eşleştirme
    const categoryResult = await findOrCreateCategory(item.category || item.mainCategory || item.topCategory || item.subCategory);
    const brandResult = await findOrCreateBrand(item.brand);

    // Varyant kontrolü - XML'de varyant bilgisi var mı?
    const hasVariants = !!(item.sku && item.sku.includes('-'));

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          xmlKey: item.xmlKey,
          title: item.title,
          sku: item.sku,
          barcode: item.barcode,
          stock: Number.isFinite(item.stock) ? item.stock : 0,
          minStock: Number.isFinite(item.minStock) ? item.minStock : 0,
          salePrice: item.price,
          vatRate: item.tax,
          description: item.description,
          images: item.images,
          categoryId: categoryResult.id,
          brandId: brandResult.id,
          categoryMatch: categoryResult.matched,
          brandMatch: brandResult.matched,
          variantMatch: hasVariants,
          status: 'XML',
        },
      });

      results.push({
        xmlKey: item.xmlKey,
        created: false,
        matchedBy: existingByXmlKey ? 'xmlKey' : 'sku',
        outcome: 'updated',
      });
      await prisma.xmlImportItemResult.create({
        data: {
          importRunId: run.id,
          xmlKey: item.xmlKey,
          sku: item.sku ?? null,
          outcome: 'updated',
        },
      });
      continue;
    }

    const created = await prisma.product.create({
      data: {
        xmlKey: item.xmlKey,
        title: item.title,
        sku: item.sku,
        barcode: item.barcode,
        stock: Number.isFinite(item.stock) ? item.stock : 0,
        minStock: Number.isFinite(item.minStock) ? item.minStock : 0,
        salePrice: item.price,
        vatRate: item.tax,
        description: item.description,
        images: item.images,
        categoryId: categoryResult.id,
        brandId: brandResult.id,
        categoryMatch: categoryResult.matched,
        brandMatch: brandResult.matched,
        variantMatch: hasVariants,
        status: 'XML',
      },
    });

    // Varyant varsa otomatik oluştur
    if (hasVariants && item.sku) {
      const variantParts = item.sku.split('-');
      if (variantParts.length >= 2) {
        const variantName = variantParts.slice(0, -1).join('-');
        const variantValue = variantParts[variantParts.length - 1];
        try {
          await prisma.variant.create({
            data: {
              name: variantName || 'Varyant',
              value: variantValue,
              productId: created.id,
            },
          });
        } catch {
          // Varyant zaten varsa hata verme
        }
      }
    }

    results.push({ xmlKey: item.xmlKey, created: true, outcome: 'created' });
    await prisma.xmlImportItemResult.create({
      data: {
        importRunId: run.id,
        xmlKey: item.xmlKey,
        sku: item.sku ?? null,
        outcome: 'created',
      },
    });
  }

  const importedCount = results.filter((item) => item.created).length;
  const updatedCount = results.filter((item) => !item.created).length;
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - run.startedAt.getTime();

  await prisma.xmlImportRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      durationMs,
      status: 'completed',
      newProducts: importedCount,
      updatedProducts: updatedCount,
      failedProducts: failedCount,
      skippedProducts: skippedCount,
    },
  });

  await prisma.xmlSource.update({
    where: { id: run.sourceId },
    data: {
      lastRunAt: finishedAt,
      lastSuccessAt: finishedAt,
      lastError: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'xml.import.success',
      actorUserId: options?.actorUserId ?? null,
      meta: JSON.stringify({
        sourceName: options?.sourceName ?? null,
        importedCount,
        updatedCount,
        totalItems: results.length,
      }),
    },
  });

  return {
    ok: true,
    importedCount,
    updatedCount,
    skippedCount,
    failedCount,
    items: results,
    runId: run.id,
  } satisfies XmlImportResult;
}

export async function fetchXmlFromUrl(url: string) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`XML fetch failed with status ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('XML content is empty');
  }

  return text;
}
