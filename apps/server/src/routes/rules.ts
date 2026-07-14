import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';

const router = Router();

const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'between', 'empty', 'not_empty'];

function evaluateCondition(product: any, condition: any): boolean {
  const val = product[condition.field];
  switch (condition.operator) {
    case 'eq': return String(val) === String(condition.value);
    case 'neq': return String(val) !== String(condition.value);
    case 'gt': return Number(val) > Number(condition.value);
    case 'gte': return Number(val) >= Number(condition.value);
    case 'lt': return Number(val) < Number(condition.value);
    case 'lte': return Number(val) <= Number(condition.value);
    case 'contains': return String(val || '').toLowerCase().includes(String(condition.value).toLowerCase());
    case 'in': return (condition.value || []).includes(val);
    case 'between': return Number(val) >= Number(condition.value?.[0] ?? 0) && Number(val) <= Number(condition.value?.[1] ?? Infinity);
    case 'empty': return !val || val === '';
    case 'not_empty': return !!val && val !== '';
    default: return false;
  }
}

async function executeAction(productId: string, action: any): Promise<string> {
  const data: Record<string, unknown> = {};
  switch (action.type) {
    case 'SET_STATUS': data.status = action.value; break;
    case 'SET_PRICE': data.salePrice = Number(action.value); break;
    case 'SET_STOCK': data.stock = Number(action.value); break;
    case 'SET_BRAND': data.brandId = action.value; data.brandMatch = true; break;
    case 'SET_CATEGORY': data.categoryId = action.value; data.categoryMatch = true; break;
    case 'SET_TITLE': data.computedTitle = action.value; break;
    default: return 'UNKNOWN_ACTION';
  }
  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id: productId }, data });
    return 'APPLIED';
  }
  return 'SKIPPED';
}

// CRUD
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const category = req.query.category ? String(req.query.category) : undefined;
    const where = category ? { category } : {};
    const items = await prisma.rule.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
    res.json({ items });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kurallar alınamadı' } }); }
});

router.post('/', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { name, description, category, condition, action, priority, xmlSourceId, brandId, categoryId, marketplaceId } = req.body;
    const item = await prisma.rule.create({
      data: { name, description, category, condition: JSON.stringify(condition), action: JSON.stringify(action), priority: priority || 0, xmlSourceId: xmlSourceId || null, brandId: brandId || null, categoryId: categoryId || null, marketplaceId: marketplaceId || null },
    });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kural oluşturulamadı' } }); }
});

router.put('/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { name, description, category, condition, action, priority, isActive } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (condition !== undefined) data.condition = JSON.stringify(condition);
    if (action !== undefined) data.action = JSON.stringify(action);
    if (priority !== undefined) data.priority = priority;
    if (isActive !== undefined) data.isActive = isActive;
    data.version = { increment: 1 };
    const item = await prisma.rule.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kural güncellenemedi' } }); }
});

router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try { await prisma.rule.delete({ where: { id: req.params.id } }); res.status(204).send(); }
  catch { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kural silinemedi' } }); }
});

// POST /rules/test - Kural test et
router.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { condition, productIds } = req.body;
    if (!condition || !productIds) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'condition ve productIds required' } });
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, take: 100 });
    let matchedCount = 0;
    for (const p of products) {
      if (evaluateCondition(p, condition)) matchedCount++;
    }
    res.json({ totalTested: products.length, matchedCount, matchRate: products.length > 0 ? Math.round(matchedCount / products.length * 100) : 0 });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Test başarısız' } }); }
});

// POST /rules/execute/:productId - Kural çalıştır
router.post('/execute/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });

    const rules = await prisma.rule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } });
    const results: Array<{ ruleId: string; ruleName: string; result: string }> = [];

    for (const rule of rules) {
      const condition = JSON.parse(rule.condition);
      const action = JSON.parse(rule.action);
      const matched = evaluateCondition(product, condition);

      if (matched) {
        const result = await executeAction(product.id, action);
        results.push({ ruleId: rule.id, ruleName: rule.name, result });
      } else {
        results.push({ ruleId: rule.id, ruleName: rule.name, result: 'SKIPPED' });
      }
    }

    res.json({ productId: req.params.productId, totalRules: rules.length, results });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kural çalıştırılamadı' } }); }
});

// GET /rules/logs - Kural logları
router.get('/logs', requireAuth, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.ruleLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ items });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Loglar alınamadı' } }); }
});

// GET /rules/operators - Desteklenen operatörler
router.get('/operators', (_req: Request, res: Response) => res.json({ items: OPERATORS }));

export default router;
