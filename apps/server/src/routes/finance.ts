// ==================== FİNANS MODÜLÜ V1.0 ROUTES ====================
import { Router, Request, Response } from 'express';
import {
  getFinanceDashboard, getMarketplaceProfitability, getProductProfitability,
  addExpense, getExpenses, addIncome, getIncomes,
  addPayable, getPayables, addPayment,
  createAccount, getAccounts, transferMoney,
  getAlarms, checkAndCreateAlarms,
  createOrderAccounting, getOrderAccounting,
  calculateRealProfitability, getProductRealProfitability, getBulkRealProfitability,
} from '../services/financeEngine.ts';

export const financeRouter = Router();

// ==================== 1. DASHBOARD ====================
financeRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const dashboard = await getFinanceDashboard();
    res.json({ ok: true, data: dashboard });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 2. PAZARYERİ KARLILIK ====================
financeRouter.get('/marketplace-profitability', async (_req: Request, res: Response) => {
  try {
    const data = await getMarketplaceProfitability();
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 3. ÜRÜN KARLILIK ====================
financeRouter.get('/product-profitability', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const sortBy = (req.query.sortBy as string) || 'profitPercentage';
    const sortDir = (req.query.sortDir as 'asc' | 'desc') || 'desc';
    const data = await getProductProfitability(page, limit, sortBy, sortDir);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 4. GİDER ====================
financeRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const expense = await addExpense(req.body);
    res.json({ ok: true, data: expense });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.get('/expenses', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getExpenses(page, limit);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 5. GELİR ====================
financeRouter.post('/incomes', async (req: Request, res: Response) => {
  try {
    const income = await addIncome(req.body);
    res.json({ ok: true, data: income });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.get('/incomes', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getIncomes(page, limit);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 6. CARİ HESAP ====================
financeRouter.post('/payables', async (req: Request, res: Response) => {
  try {
    const payable = await addPayable(req.body);
    res.json({ ok: true, data: payable });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.get('/payables', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getPayables(page, limit);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.post('/payables/:id/payments', async (req: Request, res: Response) => {
  try {
    const payment = await addPayment(req.params.id, req.body);
    res.json({ ok: true, data: payment });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 7. BANKA/KASA ====================
financeRouter.get('/accounts', async (_req: Request, res: Response) => {
  try {
    const accounts = await getAccounts();
    res.json({ ok: true, data: accounts });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.post('/accounts', async (req: Request, res: Response) => {
  try {
    const account = await createAccount(req.body);
    res.json({ ok: true, data: account });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.post('/transfer', async (req: Request, res: Response) => {
  try {
    const { fromAccountId, toAccountId, amount, description } = req.body;
    const result = await transferMoney(fromAccountId, toAccountId, amount, description);
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== 8. ALARMLAR ====================
financeRouter.get('/alarms', async (_req: Request, res: Response) => {
  try {
    const alarms = await getAlarms();
    res.json({ ok: true, data: alarms });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.post('/alarms/check', async (_req: Request, res: Response) => {
  try {
    const alarms = await checkAndCreateAlarms();
    res.json({ ok: true, data: alarms });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== AŞAMA 4: OTOMATİK MUHASEBE ====================
financeRouter.post('/orders/:id/accounting', async (req: Request, res: Response) => {
  try {
    const entries = await createOrderAccounting(req.params.id);
    res.json({ ok: true, data: entries });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.get('/orders/:id/accounting', async (req: Request, res: Response) => {
  try {
    const entries = await getOrderAccounting(req.params.id);
    res.json({ ok: true, data: entries });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== AŞAMA 5: GERÇEK KARLILIK ====================
financeRouter.post('/calculate-profitability', async (req: Request, res: Response) => {
  try {
    const { salePrice, options } = req.body;
    if (!salePrice) return res.status(400).json({ ok: false, error: 'salePrice gerekli' });
    const result = await calculateRealProfitability(salePrice, options);
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.get('/product-profitability/:id', async (req: Request, res: Response) => {
  try {
    const result = await getProductRealProfitability(req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

financeRouter.get('/bulk-profitability', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getBulkRealProfitability(page, limit);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default financeRouter;
