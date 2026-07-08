import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole } from '../auth/authMiddleware.ts';

const router = Router();

// GET /automation - List all automation rules
router.get('/', async (_req, res) => {
  try {
    const items = await prisma.automationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ items });
  } catch (error) {
    console.error('[automation] GET error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Veritabanı hatası' } });
  }
});

// POST /automation - Create a new automation rule
router.post('/', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const {
      name,
      type,
      triggerType,
      triggerConfig,
      actionType,
      actionConfig,
      active,
      schedule,
      marketplaceId,
    } = req.body;

    if (!name || !type || !triggerType || !actionType) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'name, type, triggerType ve actionType zorunludur' },
      });
    }

    const item = await prisma.automationRule.create({
      data: {
        name: String(name).trim(),
        type: String(type).trim(),
        triggerType: String(triggerType).trim(),
        triggerConfig: triggerConfig || {},
        actionType: String(actionType).trim(),
        actionConfig: actionConfig || {},
        active: active !== undefined ? Boolean(active) : true,
        schedule: schedule || null,
        marketplaceId: marketplaceId || null,
      },
    });

    return res.status(201).json({ ok: true, item });
  } catch (error) {
    console.error('[automation] POST error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Otomasyon kuralı oluşturulamadı' } });
  }
});

// PUT /automation/:id - Update an automation rule
router.put('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      triggerType,
      triggerConfig,
      actionType,
      actionConfig,
      active,
      schedule,
      marketplaceId,
    } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (type !== undefined) data.type = String(type).trim();
    if (triggerType !== undefined) data.triggerType = String(triggerType).trim();
    if (triggerConfig !== undefined) data.triggerConfig = triggerConfig;
    if (actionType !== undefined) data.actionType = String(actionType).trim();
    if (actionConfig !== undefined) data.actionConfig = actionConfig;
    if (active !== undefined) data.active = Boolean(active);
    if (schedule !== undefined) data.schedule = schedule;
    if (marketplaceId !== undefined) data.marketplaceId = marketplaceId || null;

    const item = await prisma.automationRule.update({
      where: { id },
      data,
    });

    return res.json({ ok: true, item });
  } catch (error) {
    console.error('[automation] PUT error:', error);
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Otomasyon kuralı bulunamadı' } });
  }
});

// POST /automation/:id/toggle - Toggle active status
router.post('/:id/toggle', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Otomasyon kuralı bulunamadı' } });
    }

    const item = await prisma.automationRule.update({
      where: { id },
      data: { active: !existing.active },
    });

    return res.json({ ok: true, item });
  } catch (error) {
    console.error('[automation] TOGGLE error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Durum değiştirilemedi' } });
  }
});

// POST /automation/:id/run - Run automation rule manually
router.post('/:id/run', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await prisma.automationRule.findUnique({ where: { id } });
    if (!rule) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Otomasyon kuralı bulunamadı' } });
    }

    // Log the manual run
    await prisma.auditLog.create({
      data: {
        action: 'AUTOMATION_RUN',
        entity: 'automation',
        entityId: id,
        details: JSON.stringify({ ruleName: rule.name, type: rule.type, manual: true }),
        actorUserId: (req as any).actor?.userId || null,
      },
    });

    return res.json({
      ok: true,
      message: `"${rule.name}" kuralı manuel olarak çalıştırıldı`,
    });
  } catch (error) {
    console.error('[automation] RUN error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Kural çalıştırılamadı' } });
  }
});

// DELETE /automation/:id - Delete an automation rule
router.delete('/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.automationRule.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[automation] DELETE error:', error);
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Otomasyon kuralı bulunamadı' } });
  }
});

// GET /automation/logs - Get automation execution logs
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const ruleId = req.query.ruleId ? String(req.query.ruleId) : null;

    const where: Record<string, unknown> = {};
    if (ruleId) where.entityId = ruleId;
    where.action = 'AUTOMATION_RUN';

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actorUser: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[automation] LOGS error:', error);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Loglar alınamadı' } });
  }
});

export default router;
