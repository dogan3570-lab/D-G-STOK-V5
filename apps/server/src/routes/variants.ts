import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';

const router = Router();

// GET /variants - List all variants with optional filters
router.get('/', async (req, res) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const name = req.query?.name ? String(req.query.name).trim() : null;
    const page = Math.max(1, Number(req.query?.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query?.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { value: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (name) {
      where.name = name;
    }

    const [items, total] = await Promise.all([
      prisma.variant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: {
            select: { id: true, title: true, xmlKey: true, sku: true },
          },
        },
      }),
      prisma.variant.count({ where }),
    ]);

    return res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[variants] GET error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Veritabanı hatası' } });
  }
});

// GET /variants/types - Get distinct variant types/names
router.get('/types', async (_req, res) => {
  try {
    const types = await prisma.variant.groupBy({
      by: ['name'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
    });

    return res.json({
      items: types.map(t => ({
        name: t.name,
        count: t._count.name,
      })),
    });
  } catch (error) {
    console.error('[variants] GET types error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Veritabanı hatası' } });
  }
});

// POST /variants - Create a new variant
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, value, productId } = req.body;

    if (!name || !value) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'name ve value zorunludur' },
      });
    }

    const item = await prisma.variant.create({
      data: {
        name: String(name).trim(),
        value: String(value).trim(),
        productId: productId || '',
      },
    });
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    console.error('[variants] POST error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Varyant oluşturulamadı' } });
  }
});

// POST /variants/batch - Add same variant to multiple products
router.post('/batch', requireAuth, async (req, res) => {
  try {
    const { name, value, productIds } = req.body;

    if (!name || !value || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'name, value ve productIds (dizi) zorunludur' },
      });
    }

    // Check which products already have this variant
    const existingVariants = await prisma.variant.findMany({
      where: {
        name: String(name).trim(),
        value: String(value).trim(),
        productId: { in: productIds },
      },
      select: { productId: true },
    });

    const existingProductIds = new Set(existingVariants.map(v => v.productId));
    const newProductIds = productIds.filter((id: string) => !existingProductIds.has(id));

    if (newProductIds.length === 0) {
      return res.json({
        ok: true,
        message: 'Tüm ürünlerde bu varyant zaten mevcut',
        created: 0,
        skipped: productIds.length,
      });
    }

    // Create variants for products that don't have this variant yet
    const data = newProductIds.map((productId: string) => ({
      name: String(name).trim(),
      value: String(value).trim(),
      productId,
    }));

    await prisma.variant.createMany({ data });

    return res.status(201).json({
      ok: true,
      message: `${newProductIds.length} ürüne varyant eklendi`,
      created: newProductIds.length,
      skipped: existingProductIds.size,
    });
  } catch (error) {
    console.error('[variants] POST batch error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Toplu varyant eklenemedi' } });
  }
});

// PUT /variants/:id - Update a variant
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, productId } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (value !== undefined) data.value = String(value).trim();
    if (productId !== undefined) data.productId = productId || null;

    const item = await prisma.variant.update({
      where: { id },
      data,
    });

    return res.json({ ok: true, item });
  } catch (error) {
    console.error('[variants] PUT error:', error);
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Varyant bulunamadı' } });
  }
});

// DELETE /variants/:id - Delete a variant
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.variant.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[variants] DELETE error:', error);
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Varyant bulunamadı' } });
  }
});

export default router;
