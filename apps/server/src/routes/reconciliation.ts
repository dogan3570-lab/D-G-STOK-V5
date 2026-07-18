// ==================== MUTABAKAT ROUTES ====================
import { Router, Request, Response } from 'express';
import { runReconciliation, getReconciliationReport, getReconciliationSummary, recordPayment, getReconciliationBatches } from '../services/reconciliationEngine.ts';

export const reconciliationRouter = Router();

// Mutabakat çalıştır
reconciliationRouter.post('/run', async (req: Request, res: Response) => {
  try {
    const { marketplaceId, startDate, endDate } = req.body;
    if (!marketplaceId || !startDate || !endDate) {
      return res.status(400).json({ ok: false, error: 'marketplaceId, startDate, endDate gerekli' });
    }
    const result = await runReconciliation(marketplaceId, startDate, endDate);
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Mutabakat raporu
reconciliationRouter.get('/report', async (req: Request, res: Response) => {
  try {
    const marketplaceId = req.query.marketplaceId as string;
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getReconciliationReport(marketplaceId, status, page, limit);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Mutabakat özeti
reconciliationRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const marketplaceId = req.query.marketplaceId as string;
    const data = await getReconciliationSummary(marketplaceId);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Ödeme kaydı
reconciliationRouter.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { actualPayment, paymentDate, bankAccountId, notes } = req.body;
    const result = await recordPayment(req.params.id, actualPayment, paymentDate, bankAccountId, notes);
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Batch listesi
reconciliationRouter.get('/batches', async (req: Request, res: Response) => {
  try {
    const marketplaceId = req.query.marketplaceId as string;
    const data = await getReconciliationBatches(marketplaceId);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default reconciliationRouter;
