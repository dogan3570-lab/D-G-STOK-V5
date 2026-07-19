// ==================== AI COPILOT REST API V1 ====================
// DG STOK V5.0 - Doğal Dil ile Sistem Yönetimi
// ==============================================================

import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { CopilotEngine } from '../services/copilot/CopilotEngine.ts';

export const copilotRouter = Router();
const copilot = new CopilotEngine();

// POST /copilot/chat - Sohbet
copilotRouter.post('/chat', requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'question zorunludur' } });
    }
    const result = await copilot.chat(question);
    return res.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('[copilot] Chat error:', error);
    return res.status(500).json({ ok: false, error: { code: 'COPILOT_ERROR', message: error.message } });
  }
});

// POST /copilot/execute - Görevi onayla/çalıştır
copilotRouter.post('/execute', requireAuth, async (req, res) => {
  try {
    const { taskId, approved } = req.body;
    if (!taskId) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'taskId zorunludur' } });
    }

    let result;
    if (approved) {
      result = await copilot.approveTask(taskId);
    } else {
      result = await copilot.rejectTask(taskId);
    }

    return res.json({ ok: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'EXECUTE_ERROR', message: error.message } });
  }
});

// GET /copilot/history - Konuşma geçmişi
copilotRouter.get('/history', requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const history = await copilot.getHistory(limit);
    return res.json({ ok: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'HISTORY_ERROR', message: error.message } });
  }
});

// GET /copilot/suggestions - Öneriler
copilotRouter.get('/suggestions', requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 6;
    const suggestions = await copilot.getSuggestions(limit);
    return res.json({ ok: true, data: suggestions });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'SUGGESTIONS_ERROR', message: error.message } });
  }
});

// GET /copilot/tasks - Görevler
copilotRouter.get('/tasks', requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const tasks = await copilot.getTasks(limit);
    return res.json({ ok: true, data: tasks });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'TASKS_ERROR', message: error.message } });
  }
});

// GET /copilot/status - Durum
copilotRouter.get('/status', requireAuth, async (_req, res) => {
  try {
    const status = await copilot.getStatus();
    return res.json({ ok: true, data: status });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'STATUS_ERROR', message: error.message } });
  }
});
