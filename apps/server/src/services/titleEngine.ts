import { prisma } from '../db/prisma.ts';

const VARIABLE_PATTERNS: Record<string, (product: any) => string> = {
  '{BRAND}': (p) => p.brand?.name || '',
  '{PRODUCT_NAME}': (p) => p.originalTitle || p.title || p.xmlKey || '',
  '{CATEGORY}': (p) => p.category?.name || '',
  '{SUBCATEGORY}': (p) => p.category?.parent?.name || '',
  '{COLOR}': (p) => detectAttribute(p, 'Renk'),
  '{SIZE}': (p) => detectAttribute(p, 'Beden') || detectAttribute(p, 'Numara'),
  '{GENDER}': (p) => detectGender(p),
  '{MATERIAL}': (p) => detectAttribute(p, 'Materyal'),
  '{SKU}': (p) => p.sku || '',
  '{BARCODE}': (p) => p.barcode || '',
  '{XML_BRAND}': (p) => p.brand?.name || '',
  '{CUSTOM_TEXT}': () => '',
};

const MARKETPLACE_LIMITS: Record<string, number> = {
  trendyol: 100, amazon: 200, n11: 150, hepsiburada: 150, default: 150,
};

const COLOR_PATTERNS = ['kırmızı', 'mavi', 'yeşil', 'sarı', 'beyaz', 'siyah', 'mor', 'turuncu', 'pembe', 'gri', 'lacivert', 'bordo', 'bej', 'kahverengi', 'krem', 'füme', 'metalik', 'altın', 'gümüş', 'turkuaz', 'lila', 'eflatun', 'haki', 'yeşil', 'bordo'];
const SIZE_PATTERNS = ['xs', 's', 'm', 'l', 'xl', 'xxl', '3xl', '4xl', '5xl'];
const GENDER_PATTERNS = ['erkek', 'kadın', 'unisex', 'kız', 'erkek çocuk', 'kız çocuk'];

function detectAttribute(product: any, attrName: string): string {
  if (product.variants && Array.isArray(product.variants)) {
    const v = product.variants.find((v: any) => v.name?.toLowerCase() === attrName.toLowerCase());
    if (v) return v.value;
  }
  // Title'dan tespit et
  const text = [product.title, product.originalTitle, product.description].filter(Boolean).join(' ').toLowerCase();
  if (attrName === 'Renk') {
    for (const c of COLOR_PATTERNS) if (text.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return '';
}

function detectGender(product: any): string {
  const text = [product.title, product.originalTitle, product.description].filter(Boolean).join(' ').toLowerCase();
  for (const g of GENDER_PATTERNS) if (text.includes(g)) return g.charAt(0).toUpperCase() + g.slice(1);
  return '';
}

function cleanGeneratedTitle(title: string, maxLength?: number): string {
  let result = title
    .replace(/\s{2,}/g, ' ')
    .replace(/\|{2,}/g, '|')
    .replace(/\s+\|/g, '|')
    .replace(/\|\s+/g, '| ')
    .replace(/\| \|/g, '|')
    .replace(/^\||\|$/g, '')
    .replace(/^\s+|\s+$/g, '');
  if (maxLength && result.length > maxLength) result = result.substring(0, maxLength).replace(/\s+\S*$/, '');
  return result;
}

export async function generateTitle(
  productId: string,
  templateStr?: string,
  customText?: string,
  marketplaceKey?: string
): Promise<{ title: string; originalTitle: string; usedTemplate: string; length: number; maxLength: number }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, category: true, variants: true },
  });
  if (!product) throw new Error('Product not found');

  // Şablon bul
  let template = templateStr;
  if (!template) {
    const tpl = await prisma.titleTemplate.findFirst({
      where: {
        isActive: true,
        OR: [
          { xmlSourceId: product.xmlSourceId },
          { brandId: product.brandId },
          { categoryId: product.categoryId },
          { marketplaceId: null },
        ],
      },
      orderBy: { priority: 'desc' },
    });
    template = tpl?.template || '{BRAND}® {PRODUCT_NAME}';
  }

  const maxLen = marketplaceKey ? (MARKETPLACE_LIMITS[marketplaceKey] || 150) : 150;
  const context = { ...product, CUSTOM_TEXT: customText || '' };

  let result = template;
  for (const [key, resolver] of Object.entries(VARIABLE_PATTERNS)) {
    const value = key === '{CUSTOM_TEXT}' ? (customText || '') : resolver(context);
    result = result.replaceAll(key, value);
  }

  // Yasak kelimeleri temizle
  const forbiddenWords = await prisma.forbiddenWord.findMany();
  for (const fw of forbiddenWords) {
    const regex = new RegExp(`\\b${fw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, '');
  }

  result = cleanGeneratedTitle(result, maxLen);

  return {
    title: result,
    originalTitle: product.originalTitle || product.title || product.xmlKey,
    usedTemplate: template,
    length: result.length,
    maxLength: maxLen,
  };
}

export async function bulkGenerateTitle(
  productIds: string[],
  template?: string,
  marketplaceKey?: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ total: number; successful: number; failed: number; results: Array<{ id: string; title: string }> }> {
  let successful = 0, failed = 0;
  const results: Array<{ id: string; title: string }> = [];
  const BATCH = 100;

  for (let i = 0; i < productIds.length; i += BATCH) {
    const batch = productIds.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(async (id) => {
        const r = await generateTitle(id, template, undefined, marketplaceKey);
        await prisma.product.update({ where: { id }, data: { computedTitle: r.title } });
        await prisma.transformationLog.create({
          data: { productId: id, action: 'TITLE_GENERATE', oldTitle: r.originalTitle, newTitle: r.title, stepType: 'TITLE' },
        });
        return { id, title: r.title };
      })
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') { successful++; results.push(r.value); }
      else failed++;
    }
    if (onProgress) onProgress(Math.min(i + BATCH, productIds.length), productIds.length);
    await new Promise(r => setImmediate(r));
  }

  return { total: productIds.length, successful, failed, results };
}
