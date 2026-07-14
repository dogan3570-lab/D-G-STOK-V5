import { prisma } from '../db/prisma.ts';

export interface BrandPolicyResult {
  brand: string;
  brandId: string | null;
  title: string;
}

/**
 * Brand politikasını bir ürüne uygular
 */
export async function applyBrandPolicy(
  product: { id: string; title: string | null; xmlKey: string; brandUsageType?: string; originalTitle?: string | null },
  xmlBrandName: string | null,
  xmlSourceId: string | null
): Promise<BrandPolicyResult> {
  // Politikayı bul (önce xmlSourceId'ye özel, sonra genel)
  const policy = await prisma.brandPolicy.findFirst({
    where: {
      isActive: true,
      OR: [
        { xmlSourceId: xmlSourceId },
        { xmlSourceId: null },
      ],
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (!policy) {
    // Politika yoksa varsayılan: XML markasını kullan
    return {
      brand: xmlBrandName || '',
      brandId: null,
      title: product.title || product.xmlKey,
    };
  }

  // DG STOK markasını bul
  let dgBrand = policy.dgBrandId ? await prisma.brand.findUnique({ where: { id: policy.dgBrandId } }) : null;

  // Mapping'den DG marka bul
  let mapping = null;
  if (!dgBrand && xmlBrandName) {
    mapping = await prisma.brandMapping.findUnique({ where: { xmlBrandName } });
    if (mapping) {
      dgBrand = await prisma.brand.findUnique({ where: { id: mapping.dgBrandId } });
    }
  }

  const dgBrandName = dgBrand?.name || xmlBrandName || '';
  const title = product.originalTitle || product.title || product.xmlKey;
  const format = policy.prefixFormat || 'MARKA\u00ae {title}';
  const separator = policy.separator || ' | ';

  switch (policy.policyType) {
    case 1:
      // XML Markasını Kullan
      return { brand: xmlBrandName || '', brandId: null, title };

    case 2:
      // XML → DG STOK Dönüştür
      return { brand: dgBrandName, brandId: dgBrand?.id || null, title };

    case 3:
      // XML Gizle, DG Kullan
      return { brand: dgBrandName, brandId: dgBrand?.id || null, title };

    case 4:
      // DG STOK Başa Ekle
      return {
        brand: xmlBrandName || '',
        brandId: null,
        title: format.replace(/\{title\}/g, title).replace(/MARKA/g, dgBrandName),
      };

    case 5:
      // DG STOK Sona Ekle
      return {
        brand: xmlBrandName || '',
        brandId: null,
        title: `${title}${separator}${dgBrandName}`,
      };

    case 6:
      // XML Koru + DG Ön Ek
      return {
        brand: xmlBrandName || '',
        brandId: null,
        title: format.replace(/\{title\}/g, title).replace(/MARKA/g, dgBrandName),
      };

    case 7:
      // XML Sil + DG Yaz
      let cleanedTitle = title;
      if (policy.removeXmlBrand && xmlBrandName) {
        cleanedTitle = cleanedTitle.replace(new RegExp(xmlBrandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
        // Birden fazla boşluğu teke indir
        cleanedTitle = cleanedTitle.replace(/\s+/g, ' ');
      }
      return {
        brand: dgBrandName,
        brandId: dgBrand?.id || null,
        title: format.replace(/\{title\}/g, cleanedTitle).replace(/MARKA/g, dgBrandName),
      };

    default:
      return { brand: xmlBrandName || '', brandId: null, title };
  }
}
