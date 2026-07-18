// ==================== NETWORK FORENSIC ENGINE ROUTES ====================
import { Router, Request, Response } from 'express';
import { runForensic, parseHarFile, parseFiddlerRaw, compareTraces } from '../services/forensicEngine.ts';

export const forensicRouter = Router();

// ==================== POST /forensic/run ====================
forensicRouter.post('/run', async (req: Request, res: Response) => {
  try {
    const { apiUrl, apiKey, apiSecret, supplierId } = req.body;
    
    if (!apiUrl || !apiKey || !apiSecret || !supplierId) {
      return res.status(400).json({
        ok: false,
        error: 'Eksik parametre: apiUrl, apiKey, apiSecret, supplierId gerekli',
      });
    }

    console.log(`[Forensic] Running forensic analysis for ${apiUrl}`);
    const report = await runForensic(apiUrl, apiKey, apiSecret, supplierId);
    
    console.log(`[Forensic] Complete: ${report.summary.conclusion}`);
    return res.json({ ok: true, report });
  } catch (error: any) {
    console.error('[Forensic] Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== POST /forensic/import-trace ====================
forensicRouter.post('/import-trace', async (req: Request, res: Response) => {
  try {
    const { content, format, source } = req.body;
    
    if (!content) {
      return res.status(400).json({ ok: false, error: 'İçerik gerekli' });
    }

    let traces;
    if (format === 'har' || source === 'har') {
      traces = parseHarFile(content);
    } else if (format === 'fiddler' || source === 'fiddler') {
      traces = parseFiddlerRaw(content);
    } else {
      return res.status(400).json({ ok: false, error: 'Desteklenmeyen format. Desteklenen: har, fiddler' });
    }

    return res.json({ ok: true, traces, count: traces.length });
  } catch (error: any) {
    console.error('[Forensic] Import error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== POST /forensic/compare ====================
forensicRouter.post('/compare', async (req: Request, res: Response) => {
  try {
    const { dgstokRequest, stockmountRequest } = req.body;
    
    if (!dgstokRequest || !stockmountRequest) {
      return res.status(400).json({ ok: false, error: 'dgstokRequest ve stockmountRequest gerekli' });
    }

    const comparison = compareTraces(dgstokRequest, stockmountRequest);
    return res.json({ ok: true, comparison });
  } catch (error: any) {
    console.error('[Forensic] Compare error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

export default forensicRouter;
