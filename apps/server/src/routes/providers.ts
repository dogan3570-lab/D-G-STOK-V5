import { Router } from 'express';
import { requireAuth } from '../auth/authMiddleware.ts';
import { getProvider, getAvailableProviders, listSupportedTypes } from '../services/providers/ProviderRegistry.ts';

export const providersRouter = Router();

// GET /api/providers - Kullanilabilir provider'lari listele
providersRouter.get('/', (_req, res) => {
  const providers = getAvailableProviders();
  res.json({
    ok: true,
    providers: providers.map(p => ({
      type: p.type,
      name: p.info.name,
      description: p.info.description,
      version: p.info.version,
      supportsStreaming: p.info.supportsStreaming,
      supportsSchedule: p.info.supportsSchedule,
    })),
    supportedTypes: listSupportedTypes(),
  });
});

// POST /api/providers/test - Provider baglantisini test et
providersRouter.post('/test', requireAuth, async (req, res) => {
  try {
    const { type, config } = req.body;
    if (!type) return res.status(400).json({ ok: false, error: 'Provider tipi zorunludur' });

    const provider = getProvider(type);
    if (!provider) return res.status(400).json({ ok: false, error: `Desteklenmeyen provider: ${type}` });

    const errors = provider.validateConfig(config);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: 'Gecersiz yapilandirma', details: errors });
    }

    const result = await provider.testConnection(config);
    return res.json({ ok: true, result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/providers/fetch - Provider'dan veri cek
providersRouter.post('/fetch', requireAuth, async (req, res) => {
  try {
    const { type, config } = req.body;
    if (!type) return res.status(400).json({ ok: false, error: 'Provider tipi zorunludur' });

    const provider = getProvider(type);
    if (!provider) return res.status(400).json({ ok: false, error: `Desteklenmeyen provider: ${type}` });

    const result = await provider.fetch(config);
    return res.json({ ok: true, result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});
