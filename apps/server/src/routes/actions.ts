import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { enqueueMarketplaceSync } from '../actions/marketplaceSync.ts';
import { broadcastSSE } from '../sse/events.ts';

export const actionsRouter = Router();

actionsRouter.post(
  '/marketplace/sync',
  requireAuth,
  requireRole(['ADMIN', 'OPERATOR']),
  async (req, res) => {
    try {
      const marketplaceKey = String(req.body?.marketplaceKey ?? '').trim();
      const totalStepsRaw = req.body?.totalSteps;
      const totalSteps = totalStepsRaw == null ? undefined : Number(totalStepsRaw);

      if (!marketplaceKey) {
        return res.status(400).json({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'marketplaceKey required' },
        });
      }

      if (totalSteps != null && (!Number.isFinite(totalSteps) || totalSteps <= 0 || !Number.isInteger(totalSteps))) {
        return res.status(400).json({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'totalSteps must be a positive integer' },
        });
      }

      const result = await enqueueMarketplaceSync(
        {
          marketplaceKey,
          totalSteps: totalSteps as number | undefined,
        },
        (req as AuthedRequest).actor
      );

      if (result.skipped) {
        broadcastSSE('marketplace.sync.duplicate', {
          marketplaceKey,
          jobId: result.job?.idempotencyKey ?? null,
          reason: 'idempotent_skip',
        });
      }

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unexpected error',
        },
      });
    }
  }
);

