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
      // Find categories that have no products or all products have categoryMatch = false
      // This is a simplified check - in production you might want a more complex query
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

// GET /categories/:id - Get single category
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
    // TODO: Implement after Prisma generate
    const productCount = 0;

    if (productCount > 0) {
      return res.status(400).json({
        error: { code: 'HAS_PRODUCTS', message: 'Cannot delete category with products' },
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

    // TODO: Implement after Prisma generate
    res.json({ matchedCount: 0, message: 'Not implemented yet - requires Prisma generate' });
  } catch (error) {
    console.error('Error matching products to category:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to match products' } });
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

    // TODO: Implement after Prisma generate
    res.json({ unmatchedCount: 0, message: 'Not implemented yet - requires Prisma generate' });
  } catch (error) {
    console.error('Error unmatching products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unmatch products' } });
  }
});

export default router;
