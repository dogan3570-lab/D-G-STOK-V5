// ==================== AKILLI STOK KORUMA MOTORU V3.0 ROUTES ====================
// V3: Ürün bazlı kritik stok, simülasyon, acil durum, sağlık puanı, son kontrol
// ============================================================================
import { Router, Request, Response } from 'express';
import { stockProtectionEngine, TriggerType } from '../services/stockProtection/StockProtectionEngine.ts';

export const stockProtectionRouter = Router();

// ==================== KONFİGÜRASYON ====================
stockProtectionRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = stockProtectionEngine.getConfig();
    res.json({ ok: true, data: config });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

stockProtectionRouter.put('/config', async (req: Request, res: Response) => {
  try {
    const config = stockProtectionEngine.updateConfig(req.body);
    res.json({ ok: true, data: config });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== TEK ÜRÜN KONTROLÜ ====================
stockProtectionRouter.post('/check', async (req: Request, res: Response) => {
  try {
    const { productId, stock, marketplaceKeys, triggerType } = req.body;
    if (!productId || stock === undefined) {
      return res.status(400).json({ ok: false, error: 'productId ve stock zorunludur' });
    }
    const actions = await stockProtectionEngine.checkProductStock(
      productId,
      Number(stock),
      marketplaceKeys || [],
      (triggerType as TriggerType) || 'MANUAL'
    );
    res.json({ ok: true, data: { actions, count: actions.length } });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== TOPLU KONTROL ====================
stockProtectionRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    const { stockUpdates, marketplaceKeys, triggerType } = req.body;
    if (!stockUpdates || !Array.isArray(stockUpdates)) {
      return res.status(400).json({ ok: false, error: 'stockUpdates dizisi zorunludur' });
    }
    const result = await stockProtectionEngine.batchCheck(
      stockUpdates,
      marketplaceKeys || [],
      (triggerType as TriggerType) || 'MANUAL'
    );
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== XML STOK GÜNCELLEMESİ ====================
stockProtectionRouter.post('/xml-update', async (req: Request, res: Response) => {
  try {
    const { xmlSourceId, products, triggerType } = req.body;
    if (!xmlSourceId || !products || !Array.isArray(products)) {
      return res.status(400).json({ ok: false, error: 'xmlSourceId ve products dizisi zorunludur' });
    }
    const result = await stockProtectionEngine.processXmlStockUpdate(
      xmlSourceId,
      products,
      (triggerType as TriggerType) || 'XML_MANUAL'
    );
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== SCHEDULER KUYRUK ====================
stockProtectionRouter.post('/enqueue', async (req: Request, res: Response) => {
  try {
    const { xmlSourceId, products, triggerType } = req.body;
    if (!xmlSourceId || !products || !Array.isArray(products)) {
      return res.status(400).json({ ok: false, error: 'xmlSourceId ve products dizisi zorunludur' });
    }
    await stockProtectionEngine.enqueueXmlUpdate(
      xmlSourceId,
      products,
      (triggerType as TriggerType) || 'XML_SCHEDULER'
    );
    res.json({ ok: true, data: { message: 'Job queued for processing' } });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== MUAFİYET YÖNETİMİ ====================
stockProtectionRouter.post('/exemption', async (req: Request, res: Response) => {
  try {
    const { productId, exempt, reason } = req.body;
    if (!productId) {
      return res.status(400).json({ ok: false, error: 'productId zorunludur' });
    }
    await stockProtectionEngine.setExemption(productId, exempt !== false, reason);
    res.json({ ok: true, data: { productId, exempt: exempt !== false } });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== İSTATİSTİK ====================
stockProtectionRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await stockProtectionEngine.getStats();
    res.json({ ok: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== QUEUE DURUMU ====================
stockProtectionRouter.get('/queue-status', async (_req: Request, res: Response) => {
  try {
    const status = await stockProtectionEngine.getQueueStatus();
    res.json({ ok: true, data: status });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== RUN LİSTESİ ====================
stockProtectionRouter.get('/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await stockProtectionEngine.getRuns(limit);
    res.json({ ok: true, data: runs });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== LOGLAR ====================
stockProtectionRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await stockProtectionEngine.getLogs(limit);
    res.json({ ok: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== V3: ACİL DURUM MODU ====================
// 🟥 ACİL DURUM - Tüm otomatik kapatma işlemlerini durdur
stockProtectionRouter.post('/emergency-stop', async (req: Request, res: Response) => {
  try {
    const { active } = req.body;
    const result = await stockProtectionEngine.setEmergencyStop(active !== false);
    res.json({
      ok: true,
      data: {
        active: result,
        message: result
          ? '🟥 ACİL DURUM AKTİF - Tüm otomatik kapatmalar durduruldu'
          : '✅ Acil durum modu devre dışı - Otomatik kapatmalar devam edebilir',
      },
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

stockProtectionRouter.get('/emergency-stop', async (_req: Request, res: Response) => {
  try {
    const status = stockProtectionEngine.getEmergencyStopStatus();
    res.json({ ok: true, data: status });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== V3: KARAR SİMÜLASYONU ====================
// SKU bazında ne olacağını göster - API çağrısı yapılmaz
stockProtectionRouter.post('/simulate', async (req: Request, res: Response) => {
  try {
    const { sku, stock, marketplaceKeys } = req.body;
    if (!sku || stock === undefined) {
      return res.status(400).json({ ok: false, error: 'sku ve stock zorunludur' });
    }
    const result = await stockProtectionEngine.simulateDecision(
      sku,
      Number(stock),
      marketplaceKeys
    );
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== V3: ADAPTER SAĞLIK PUANI ====================
// Tüm adapter'ların detaylı metrikleri
stockProtectionRouter.get('/health-scores', async (_req: Request, res: Response) => {
  try {
    const scores = await stockProtectionEngine.getAllHealthScores();
    res.json({ ok: true, data: scores });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Tek bir adapter'ın sağlık puanı (log bazlı hesaplama)
stockProtectionRouter.get('/health-scores/:marketplaceKey', async (req: Request, res: Response) => {
  try {
    const score = await stockProtectionEngine.getHealthScoreFromLogs(req.params.marketplaceKey);
    res.json({ ok: true, data: score });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default stockProtectionRouter;
