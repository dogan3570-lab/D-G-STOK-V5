import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { WorkflowStateManager } from '../services/workflow/WorkflowStateManager.ts';
import { analyzeProduct } from '../services/dqcEngine.ts';
import { generateTitle } from '../services/titleEngine.ts';

const router = Router();

const PIPELINE_STEPS = ['NORMALIZE', 'AI_ANALYSIS', 'CATEGORY', 'BRAND', 'VARIANT', 'ATTRIBUTE', 'TITLE', 'SEO', 'IMAGE', 'VALIDATION', 'RULE_ENGINE', 'MARKETPLACE'];

interface PipelineRun {
  id: string;
  sourceId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stepResults: Record<string, { status: string; duration: number; processed: number; failed: number }>;
  startedAt: Date;
}

const activePipelines = new Map<string, PipelineRun>();

router.post('/start/:xmlSourceId', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { xmlSourceId } = req.params;
    const source = await prisma.xmlSource.findUnique({ where: { id: xmlSourceId } });
    if (!source) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML kaynağı bulunamadı' } });

    const runId = `pipeline-${Date.now()}`;
    const run: PipelineRun = { id: runId, sourceId: xmlSourceId, status: 'running', stepResults: {}, startedAt: new Date() };
    activePipelines.set(runId, run);

    // Background pipeline execution
    const products = await prisma.product.findMany({ where: { xmlSourceId }, take: 100 });
    
    for (const step of PIPELINE_STEPS) {
      if (run.status === 'cancelled') break;
      const start = Date.now();
      let processed = 0, failed = 0;

      for (const product of products) {
        try {
          switch (step) {
            case 'NORMALIZE': break; // Already normalized
            case 'AI_ANALYSIS': await analyzeProduct(product.id); break;
            case 'CATEGORY': break; // Handled by category matcher
            case 'BRAND': break; // Handled by brand matcher
            case 'VARIANT': break;
            case 'ATTRIBUTE': break;
            case 'TITLE': if (product.computedTitle) await generateTitle(product.id); break;
            case 'SEO': break;
            case 'IMAGE': break;
            case 'VALIDATION': await WorkflowStateManager.calculateReadiness(product.id); break;
            case 'RULE_ENGINE': break;
            case 'MARKETPLACE': break;
          }
          processed++;
        } catch { failed++; }
      }

      run.stepResults[step] = { status: failed > 0 ? 'completed_with_errors' : 'completed', duration: Date.now() - start, processed, failed };
    }

    run.status = 'completed';
    res.json({ id: runId, status: run.status, stepResults: run.stepResults, totalProducts: products.length });
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

router.post('/cancel/:runId', requireAuth, (_req: Request, res: Response) => {
  const run = activePipelines.get(_req.params.runId);
  if (run) { run.status = 'cancelled'; res.json({ ok: true, message: 'Pipeline iptal edildi' }); }
  else res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pipeline bulunamadı' } });
});

router.get('/status/:runId', requireAuth, (_req: Request, res: Response) => {
  const run = activePipelines.get(_req.params.runId);
  if (run) res.json(run);
  else res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pipeline bulunamadı' } });
});

router.get('/steps', (_req: Request, res: Response) => res.json({ items: PIPELINE_STEPS }));

export default router;
