import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { applyBrandPolicy } from '../services/brandPolicy.ts';

const router = Router();

const POLICY_LABELS: Record<number, string> = {
  1: 'XML Markasını Kullan',
  2: 'XML → DG STOK Dönüştür',
  3: 'XML Gizle, DG Kullan',
  4: 'DG STOK Başa Ekle',
  5: 'DG STOK Sona Ekle',
  6: 'XML Koru + DG Ön Ek',
  7: 'XML Sil + DG Yaz',
};

// GET /brands/policies - Tüm politikaları listele
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const policies = await prisma.brandPolicy.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    const xmlSources = await prisma.xmlSource.findMany({ select: { id: true, name: true } });
    const sourceMap = new Map(xmlSources.map(s => [s.id, s.name]));

    res.json({
      items: policies.map(p => ({
        id: p.id,
        name: p.name,
        policyType: p.policyType,
        policyLabel: POLICY_LABELS[p.policyType] || 'Bilinmeyen',
        xmlSourceId: p.xmlSourceId,
        xmlSourceName: p.xmlSourceId ? sourceMap.get(p.xmlSourceId) || 'Bilinmeyen' : 'Tümü',
        dgBrandId: p.dgBrandId,
        prefixFormat: p.prefixFormat,
        separator: p.separator,
        removeXmlBrand: p.removeXmlBrand,
        isActive: p.isActive,
        priority: p.priority,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[brands-policy] GET error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politikalar alınamadı' } });
  }
});

// GET /brands/policies/:id - Tek politika
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const policy = await prisma.brandPolicy.findUnique({ where: { id: req.params.id } });
    if (!policy) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Politika bulunamadı' } });
    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politika alınamadı' } });
  }
});

// POST /brands/policies - Yeni politika
router.post('/', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { name, policyType, xmlSourceId, dgBrandId, prefixFormat, separator, removeXmlBrand, isActive, priority } = req.body;
    if (!name || !policyType) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name ve policyType zorunludur' } });
    if (policyType < 1 || policyType > 7) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'policyType 1-7 arası olmalıdır' } });

    const policy = await prisma.brandPolicy.create({
      data: {
        name, policyType: Number(policyType),
        xmlSourceId: xmlSourceId || null, dgBrandId: dgBrandId || null,
        prefixFormat: prefixFormat || null, separator: separator || ' | ',
        removeXmlBrand: removeXmlBrand || false, isActive: isActive !== false,
        priority: priority != null ? Number(priority) : 0,
      },
    });

    await prisma.brandLog.create({
      data: {
        action: 'POLICY_CREATE', details: JSON.stringify({ policyId: policy.id, name, policyType }),
        actorUserId: (req as AuthedRequest).actor?.userId || null,
      },
    });

    res.status(201).json(policy);
  } catch (error) {
    console.error('[brands-policy] POST error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politika oluşturulamadı' } });
  }
});

// PUT /brands/policies/:id - Politika güncelle
router.put('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, policyType, xmlSourceId, dgBrandId, prefixFormat, separator, removeXmlBrand, isActive, priority } = req.body;
    const existing = await prisma.brandPolicy.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Politika bulunamadı' } });

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (policyType !== undefined) data.policyType = Number(policyType);
    if (xmlSourceId !== undefined) data.xmlSourceId = xmlSourceId || null;
    if (dgBrandId !== undefined) data.dgBrandId = dgBrandId || null;
    if (prefixFormat !== undefined) data.prefixFormat = prefixFormat || null;
    if (separator !== undefined) data.separator = separator || ' | ';
    if (removeXmlBrand !== undefined) data.removeXmlBrand = removeXmlBrand;
    if (isActive !== undefined) data.isActive = isActive;
    if (priority !== undefined) data.priority = Number(priority);

    const policy = await prisma.brandPolicy.update({ where: { id }, data });

    await prisma.brandLog.create({
      data: {
        action: 'POLICY_UPDATE', details: JSON.stringify({ policyId: id, changes: Object.keys(data) }),
        actorUserId: (req as AuthedRequest).actor?.userId || null,
      },
    });

    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politika güncellenemedi' } });
  }
});

// DELETE /brands/policies/:id - Politika sil
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.brandPolicy.delete({ where: { id } });
    await prisma.brandLog.create({
      data: { action: 'POLICY_DELETE', details: JSON.stringify({ policyId: id }), actorUserId: (req as AuthedRequest).actor?.userId || null },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politika silinemedi' } });
  }
});

// POST /brands/policies/preview - Politika önizleme
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { policyType, dgBrandId, prefixFormat, separator, removeXmlBrand, xmlBrandName, productTitle } = req.body;
    if (!policyType) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'policyType zorunludur' } });

    let dgBrand = dgBrandId ? await prisma.brand.findUnique({ where: { id: dgBrandId } }) : null;
    const dgBrandName = dgBrand?.name || (xmlBrandName || 'MARKA');
    const title = productTitle || 'Air Max 90 Erkek Spor Ayakkabı';
    const fmt = prefixFormat || 'MARKA\u00ae {title}';
    const sep = separator || ' | ';

    let result: { brand: string; title: string } = { brand: xmlBrandName || '', title };

    switch (Number(policyType)) {
      case 1: result = { brand: xmlBrandName || 'Nike', title }; break;
      case 2: result = { brand: dgBrandName, title }; break;
      case 3: result = { brand: dgBrandName, title }; break;
      case 4: result = { brand: xmlBrandName || '', title: fmt.replace(/\{title\}/g, title).replace(/MARKA/g, dgBrandName) }; break;
      case 5: result = { brand: xmlBrandName || '', title: `${title}${sep}${dgBrandName}` }; break;
      case 6: result = { brand: xmlBrandName || '', title: fmt.replace(/\{title\}/g, title).replace(/MARKA/g, dgBrandName) }; break;
      case 7: {
        let cleaned = title;
        if (removeXmlBrand && xmlBrandName) {
          cleaned = title.replace(new RegExp(xmlBrandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim().replace(/\s+/g, ' ');
        }
        result = { brand: dgBrandName, title: fmt.replace(/\{title\}/g, cleaned).replace(/MARKA/g, dgBrandName) };
        break;
      }
    }

    res.json({
      preview: result,
      policyLabel: POLICY_LABELS[Number(policyType)] || 'Bilinmeyen',
      input: { xmlBrandName: xmlBrandName || 'Nike', productTitle: title },
      config: { dgBrandName, prefixFormat: fmt, separator: sep, removeXmlBrand },
    });
  } catch (error) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Önizleme alınamadı' } });
  }
});

// POST /brands/policies/apply/:xmlSourceId - Politikayı XML kaynağına uygula (tüm ürünler)
router.post('/apply/:xmlSourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { xmlSourceId } = req.params;
    const products = await prisma.product.findMany({
      where: { xmlSourceId },
      select: { id: true, title: true, xmlKey: true, originalTitle: true, brand: { select: { name: true } } },
    });

    let updatedCount = 0;
    for (const product of products) {
      const xmlBrandName = product.brand?.name || null;
      const result = await applyBrandPolicy(product, xmlBrandName, xmlSourceId);

      const updateData: Record<string, unknown> = {
        brandUsageType: 'DG_BRAND',
        brandMatch: true,
        originalTitle: product.originalTitle || product.title || product.xmlKey,
        computedTitle: result.title,
      };

      if (result.brandId) updateData.brandId = result.brandId;

      await prisma.product.update({ where: { id: product.id }, data: updateData });
      updatedCount++;
    }

    await prisma.brandLog.create({
      data: {
        action: 'POLICY_APPLY', productCount: updatedCount,
        details: JSON.stringify({ xmlSourceId }),
        actorUserId: (req as AuthedRequest).actor?.userId || null,
      },
    });

    res.json({ updatedCount, message: `${updatedCount} ürüne politika uygulandı` });
  } catch (error) {
    console.error('[brands-policy] POST apply error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Politika uygulanamadı' } });
  }
});

export { POLICY_LABELS };
export default router;
