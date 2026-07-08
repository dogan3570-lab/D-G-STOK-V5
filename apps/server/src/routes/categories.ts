import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';

const router = Router();

// GET /categories - List all categories
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = String(req.query?.search ?? '').trim();
    const parentId = req.query?.parentId ? String(req.query.parentId) : null;
    const unmatched = req.query?.unmatched === 'true';

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.name = { contains: search };
    }
    
    if (parentId !== undefined) {
      where.parentId = parentId || null;
    }
    
    if (unmatched) {
      where.products = {
        some: { categoryMatch: false },
      };
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const items = categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      externalId: cat.externalId,
      parentId: cat.parentId,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    res.json({ items });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories' } });
  }
});

// GET /categories/unmatched-products - Eşleşmemiş ürünleri getir (ÖZEL route, :id'den ÖNCE tanımlanmalı)
router.get('/unmatched-products', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const limit = parseInt(String(req.query.limit || '50'));
    const search = String(req.query.search || '').trim();

    const where: any = { categoryMatch: false };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching unmatched products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch unmatched products' } });
  }
});

// GET /categories/tree - Get category tree
router.get('/tree', requireAuth, async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });

    res.json({ items: categories });
  } catch (error) {
    console.error('Error fetching category tree:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category tree' } });
  }
});

// GET /categories/:id - Get single category (PARAMETRİK route, özel route'lardan SONRA)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category' } });
  }
});

// POST /categories - Create new category
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, externalId, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } });
    }

    const category = await prisma.category.create({
      data: {
        name,
        externalId: externalId || null,
        parentId: parentId || null,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create category' } });
  }
});

// PUT /categories/:id - Update category
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, externalId, parentId } = req.body;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(externalId !== undefined && { externalId }),
        ...(parentId !== undefined && { parentId }),
      },
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update category' } });
  }
});

// DELETE /categories/:id - Delete category
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has products
    const productCount = await prisma.product.count({ where: { categoryId: id } });

    if (productCount > 0) {
      return res.status(400).json({
        error: { code: 'HAS_PRODUCTS', message: 'Bu kategoride ürünler var, önce ürünleri taşıyın veya silin' },
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete category' } });
  }
});

// POST /categories/match - Match products to category
router.post('/match', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, productIds } = req.body;

    if (!categoryId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'categoryId and productIds array are required' },
      });
    }

    // Kategori var mı kontrol et
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Kategori bulunamadı' },
      });
    }

    // Ürünleri kategoriye ata
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { categoryId, categoryMatch: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CATEGORY_MATCH',
        entity: 'category',
        entityId: categoryId,
        details: `${result.count} ürün "${category.name}" kategorisine eşleştirildi`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    res.json({ matchedCount: result.count, message: `${result.count} ürün eşleştirildi` });
  } catch (error) {
    console.error('Error matching products to category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to match products' } });
  }
});

// POST /categories/auto-match - XML kategorilerine göre otomatik eşleştir
router.post('/auto-match', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;

    // Eşleşmemiş ürünleri bul
    const where: any = { categoryMatch: false };
    if (Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds };
    }

    const products = await prisma.product.findMany({
      where,
      select: { id: true, title: true, xmlKey: true },
    });

    // Tüm kategorileri al
    const categories = await prisma.category.findMany();
    
    let matchedCount = 0;
    const matchResults: Array<{ productId: string; productName: string; categoryName: string | null }> = [];

    for (const product of products) {
      // Ürün adından veya xmlKey'den kategori bulmaya çalış
      const searchText = (product.title || product.xmlKey || '').toLowerCase();
      
      // En iyi eşleşen kategoriyi bul
      let bestMatch: { id: string; name: string; score: number } | null = null;
      
      for (const cat of categories) {
        const catName = cat.name.toLowerCase();
        let score = 0;
        
        // Kategori adı ürün adında geçiyorsa
        if (searchText.includes(catName)) {
          score = catName.length / searchText.length;
        }
        
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: cat.id, name: cat.name, score };
        }
      }

      if (bestMatch) {
        await prisma.product.update({
          where: { id: product.id },
          data: { categoryId: bestMatch.id, categoryMatch: true },
        });
        matchedCount++;
        matchResults.push({
          productId: product.id,
          productName: product.title || product.xmlKey,
          categoryName: bestMatch.name,
        });
      }
    }

    res.json({
      matchedCount,
      totalProducts: products.length,
      message: `${matchedCount} ürün otomatik eşleştirildi`,
      results: matchResults,
    });
  } catch (error) {
    console.error('Error auto-matching categories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to auto-match categories' } });
  }
});

// POST /categories/unmatch - Unmatch products from category
router.post('/unmatch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'productIds array is required' },
      });
    }

    // Ürünlerin kategorilerini kaldır
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { categoryId: null, categoryMatch: false },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CATEGORY_UNMATCH',
        entity: 'category',
        details: `${result.count} ürünün kategori eşleştirmesi kaldırıldı`,
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    res.json({ unmatchedCount: result.count, message: `${result.count} ürünün eşleştirmesi kaldırıldı` });
  } catch (error) {
    console.error('Error unmatching products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unmatch products' } });
  }
});

export default router;
