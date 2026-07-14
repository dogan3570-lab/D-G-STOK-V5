import { prisma } from '../db/prisma.ts';

const CONFIDENCE_LABELS: Record<number, string> = {
  100: 'Kesin', 95: 'Çok Güvenli', 90: 'Güvenli',
  80: 'Kontrol Et', 70: 'Manuel İncele', 50: 'Önerme',
};

export function getConfidenceLabel(score: number): string {
  if (score >= 100) return 'Kesin';
  if (score >= 95) return 'Çok Güvenli';
  if (score >= 90) return 'Güvenli';
  if (score >= 80) return 'Kontrol Et';
  if (score >= 70) return 'Manuel İncele';
  return 'Önerme';
}

export async function aiSuggest(module: string, productId: string): Promise<{
  suggestions: Array<{ value: string; confidence: number; label: string; reason: string }>;
}> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { brand: true, category: true },
  });
  if (!product) throw new Error('Product not found');

  const suggestions: Array<{ value: string; confidence: number; label: string; reason: string }> = [];

  switch (module) {
    case 'CATEGORY': {
      if (product.supplierCategory) {
        const knowledge = await prisma.aIKnowledge.findMany({
          where: { module: 'CATEGORY', input: { contains: product.supplierCategory.split('>').pop()?.trim() || '' } },
          orderBy: { useCount: 'desc' },
          take: 3,
        });
        for (const k of knowledge) {
          suggestions.push({
            value: k.output,
            confidence: Math.round(k.confidence),
            label: getConfidenceLabel(k.confidence),
            reason: `${k.useCount} kez kullanıldı, ${k.acceptCount} kabul, ${k.rejectCount} red`,
          });
        }
        // Varsayılan öneri
        const catName = product.supplierCategory.split('>').pop()?.trim() || '';
        suggestions.push({ value: catName, confidence: 70, label: 'Manuel İncele', reason: 'XML kategorisinden türetildi' });
      }
      break;
    }
    case 'BRAND': {
      if (product.brand?.name) {
        const knowledge = await prisma.aIKnowledge.findMany({
          where: { module: 'BRAND', input: product.brand.name },
          orderBy: { useCount: 'desc' },
          take: 3,
        });
        for (const k of knowledge) {
          suggestions.push({
            value: k.output,
            confidence: Math.round(k.confidence),
            label: getConfidenceLabel(k.confidence),
            reason: `${k.useCount} kez kullanıldı, ${k.acceptCount} kabul`,
          });
        }
        suggestions.push({ value: product.brand.name, confidence: 85, label: 'Güvenli', reason: 'XML markası doğrudan kullanılabilir' });
      }
      break;
    }
    case 'TITLE': {
      const brandName = product.brand?.name || '';
      const template = await prisma.titleTemplate.findFirst({ where: { isActive: true }, orderBy: { priority: 'desc' } });
      const tpl = template?.template || '{BRAND}® {PRODUCT_NAME}';
      const generated = tpl.replace('{BRAND}', brandName).replace('{PRODUCT_NAME}', product.originalTitle || product.title || '');
      suggestions.push({ value: generated, confidence: 85, label: 'Güvenli', reason: 'Şablondan oluşturuldu' });
      break;
    }
    default:
      suggestions.push({ value: 'Öneri bulunamadı', confidence: 0, label: 'Önerme', reason: 'Modül için veri yok' });
  }

  return { suggestions: suggestions.sort((a, b) => b.confidence - a.confidence) };
}

export async function aiLearn(module: string, input: string, output: string, accepted: boolean): Promise<void> {
  const existing = await prisma.aIKnowledge.findUnique({ where: { module_input_output: { module, input, output } } });
  if (existing) {
    await prisma.aIKnowledge.update({
      where: { id: existing.id },
      data: {
        useCount: { increment: 1 },
        acceptCount: accepted ? { increment: 1 } : undefined,
        rejectCount: !accepted ? { increment: 1 } : undefined,
        confidence: Math.min(100, existing.confidence + (accepted ? 2 : -5)),
        lastUsedAt: new Date(),
      },
    });
  } else {
    await prisma.aIKnowledge.create({
      data: { module, input, output, confidence: accepted ? 80 : 50, useCount: 1, acceptCount: accepted ? 1 : 0, rejectCount: accepted ? 0 : 1 },
    });
  }
}
