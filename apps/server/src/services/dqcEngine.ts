import { prisma } from '../db/prisma.ts';

const WEIGHTS = { category: 10, brand: 10, title: 10, attribute: 15, images: 15, seo: 10, description: 10, barcode: 5, price: 5, stock: 5, variant: 5 };

export interface QualityResult {
  score: number; label: string; checks: Record<string, { ok: boolean; score: number; max: number; issues: string[] }>;
}

const QUALITY_LABELS = [
  { min: 95, label: 'Mükemmel', color: 'green' }, { min: 85, label: 'Çok İyi', color: 'green-400' },
  { min: 70, label: 'İyi', color: 'yellow' }, { min: 50, label: 'Riskli', color: 'orange' },
  { min: 30, label: 'Kötü', color: 'red' }, { min: 0, label: 'Gönderme', color: 'red-700' },
];

export async function analyzeProduct(productId: string): Promise<QualityResult> {
  const p = await prisma.product.findUnique({ where: { id: productId }, include: { brand: true, category: true, variants: true } });
  if (!p) throw new Error('Product not found');

  const checks: Record<string, { ok: boolean; score: number; max: number; issues: string[] }> = {};
  const title = p.title || p.xmlKey || '';
  const desc = p.description || '';

  // Kategori (10)
  const catIssues: string[] = [];
  if (!p.categoryId) catIssues.push('Kategori tanımlı değil');
  else if (!p.categoryMatch) catIssues.push('Kategori eşleşmemiş');
  checks.category = { ok: catIssues.length === 0, score: catIssues.length === 0 ? WEIGHTS.category : 0, max: WEIGHTS.category, issues: catIssues };

  // Marka (10)
  const brandIssues: string[] = [];
  if (!p.brandId) brandIssues.push('Marka tanımlı değil');
  else if (!p.brandMatch) brandIssues.push('Marka eşleşmemiş');
  checks.brand = { ok: brandIssues.length === 0, score: brandIssues.length === 0 ? WEIGHTS.brand : 0, max: WEIGHTS.brand, issues: brandIssues };

  // Başlık (10)
  const titleIssues: string[] = [];
  if (!title || title.length < 5) titleIssues.push('Başlık çok kısa');
  if (title.length > 150) titleIssues.push('Başlık çok uzun');
  if (/<[^>]+>/.test(title)) titleIssues.push('HTML etiketi var');
  if (/[\u{1F600}-\u{1F9FF}]/u.test(title)) titleIssues.push('Emoji var');
  if (/\s{2,}/.test(title)) titleIssues.push('Çift boşluk var');
  const words = title.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) { if (words[i] === words[i + 1] && words[i].length > 2) { titleIssues.push('Tekrar eden kelime'); break; } }
  checks.title = { ok: titleIssues.length === 0, score: titleIssues.length === 0 ? WEIGHTS.title : Math.max(0, WEIGHTS.title - titleIssues.length * 2), max: WEIGHTS.title, issues: titleIssues };

  // Attribute (15)
  const attrIssues: string[] = [];
  if (!p.technicalSpecs) attrIssues.push('Öznitelik eksik');
  checks.attribute = { ok: attrIssues.length === 0, score: attrIssues.length === 0 ? WEIGHTS.attribute : 0, max: WEIGHTS.attribute, issues: attrIssues };

  // Resimler (15)
  const imgIssues: string[] = [];
  const imgCount = p.images ? p.images.split(',').filter(Boolean).length : 0;
  if (imgCount === 0) imgIssues.push('Hiç resim yok');
  else if (imgCount < 3) imgIssues.push(`${imgCount} resim var, en az 3 önerilir`);
  checks.images = { ok: imgCount >= 3, score: Math.min(WEIGHTS.images, imgCount * 5), max: WEIGHTS.images, issues: imgIssues };

  // SEO (10)
  const seoIssues: string[] = [];
  if (!p.seoTitle && !p.seoDescription) seoIssues.push('SEO başlık/açıklama eksik');
  checks.seo = { ok: seoIssues.length === 0, score: seoIssues.length === 0 ? WEIGHTS.seo : 0, max: WEIGHTS.seo, issues: seoIssues };

  // Açıklama (10)
  const descIssues: string[] = [];
  if (!desc || desc.length < 20) descIssues.push('Açıklama çok kısa');
  checks.description = { ok: descIssues.length === 0, score: desc.length > 100 ? WEIGHTS.description : desc.length > 20 ? 5 : 0, max: WEIGHTS.description, issues: descIssues };

  // Barkod (5)
  const barcodeIssues: string[] = [];
  if (!p.barcode) barcodeIssues.push('Barkod eksik');
  checks.barcode = { ok: !barcodeIssues.length, score: p.barcode ? WEIGHTS.barcode : 0, max: WEIGHTS.barcode, issues: barcodeIssues };

  // Fiyat (5)
  const priceIssues: string[] = [];
  if (!p.salePrice || p.salePrice <= 0) priceIssues.push('Fiyat sıfır veya eksik');
  checks.price = { ok: priceIssues.length === 0, score: (p.salePrice ?? 0) > 0 ? WEIGHTS.price : 0, max: WEIGHTS.price, issues: priceIssues };

  // Stok (5)
  const stockIssues: string[] = [];
  if (!p.stock || p.stock <= 0) stockIssues.push('Stok negatif veya sıfır');
  checks.stock = { ok: stockIssues.length === 0, score: (p.stock ?? 0) > 0 ? WEIGHTS.stock : 0, max: WEIGHTS.stock, issues: stockIssues };

  // Varyant (5)
  const varIssues: string[] = [];
  if (!p.variantMatch) varIssues.push('Varyant eşleşmemiş');
  checks.variant = { ok: varIssues.length === 0, score: p.variantMatch ? WEIGHTS.variant : 0, max: WEIGHTS.variant, issues: varIssues };

  const totalScore = Object.values(checks).reduce((s, c) => s + c.score, 0);
  const label = QUALITY_LABELS.find(l => totalScore >= l.min)?.label || 'Gönderme';

  return { score: totalScore, label, checks };
}

export async function bulkAnalyze(productIds: string[], onProgress?: (done: number, total: number) => void): Promise<{
  total: number; average: number; distribution: Record<string, number>; results: Array<{ id: string; score: number; label: string }>;
}> {
  const distribution: Record<string, number> = {};
  let totalScore = 0;
  const results: Array<{ id: string; score: number; label: string }> = [];

  for (let i = 0; i < productIds.length; i += 100) {
    const batch = productIds.slice(i, i + 100);
    const batchResults = await Promise.allSettled(batch.map(async (id) => {
      const r = await analyzeProduct(id);
      distribution[r.label] = (distribution[r.label] || 0) + 1;
      totalScore += r.score;
      return { id, score: r.score, label: r.label };
    }));
    for (const r of batchResults) if (r.status === 'fulfilled') results.push(r.value);
    if (onProgress) onProgress(Math.min(i + 100, productIds.length), productIds.length);
    await new Promise(r => setImmediate(r));
  }

  return { total: results.length, average: results.length > 0 ? Math.round(totalScore / results.length) : 0, distribution, results };
}
