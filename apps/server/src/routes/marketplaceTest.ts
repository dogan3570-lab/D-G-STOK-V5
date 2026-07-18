// ==================== API Test Motoru V2.0 - Router ====================
import { Router } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, type AuthedRequest } from '../auth/authMiddleware.ts';
import { ApiDiagnosticEngine } from '../services/marketplace/ApiDiagnosticEngine.ts';
import type { MarketplaceConfig } from '../services/marketplace/types.ts';

export const marketplaceTestRouter = Router();

/**
 * POST /api/marketplaces/:id/test-v2
 * Yeni nesil API Test Motoru
 * Adim adim: DNS -> HTTPS -> Auth -> Yetki -> Endpoint -> JSON
 */
marketplaceTestRouter.post('/marketplaces/:id/test-v2', requireAuth, async (req, res) => {
  const id = String(req.params.id ?? '');
  if (!id) {
    return res.status(400).json({ ok: false, error: 'id zorunludur' });
  }

  try {
    const marketplace = await prisma.marketplace.findUnique({ where: { id } });
    if (!marketplace) {
      return res.status(404).json({ ok: false, error: 'Pazaryeri bulunamadi' });
    }

    // API konfigurasyonunu olustur
    let sellerId: string | undefined;
    try {
      if (marketplace.settings) {
        const settings = JSON.parse(marketplace.settings);
        sellerId = settings.sellerId || settings.merchantId;
      }
    } catch { /* ignore */ }

    const config: MarketplaceConfig = {
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      apiUrl: marketplace.apiUrl || '',
      sellerId: marketplace.merchantId || sellerId,
      storeId: marketplace.storeId || undefined,
      merchantId: marketplace.merchantId || undefined,
    };

    // Diagnostik motorunu calistir
    const engine = new ApiDiagnosticEngine(config, marketplace.key);
    const result = await engine.runDiagnostic();

    // API durumunu guncelle
    let apiStatus = 'unknown';
    if (result.overall.ok) {
      apiStatus = 'ok';
    } else if (result.authentication?.detail?.includes('401') || result.overall.httpStatus === 401) {
      apiStatus = 'unauthorized';
    } else if (result.overall.httpStatus === 403) {
      apiStatus = 'unauthorized';
    } else if (result.overall.httpStatus === 0) {
      apiStatus = 'timeout';
    } else {
      apiStatus = 'error';
    }

    await prisma.marketplace.update({
      where: { id },
      data: { apiStatus },
    });

    return res.json({
      ok: result.overall.ok,
      message: result.overall.message,
      diagnostic: {
        dns: {
          ok: result.dns.ok,
          message: result.dns.message,
          latency: result.dns.latency,
        },
        https: {
          ok: result.https.ok,
          message: result.https.message,
          latency: result.https.latency,
        },
        authentication: {
          ok: result.authentication.ok,
          message: result.authentication.message,
          detail: result.authentication.detail,
          latency: result.authentication.latency,
        },
        authorization: {
          ok: result.authorization.ok,
          message: result.authorization.message,
          detail: result.authorization.detail,
          latency: result.authorization.latency,
        },
        endpoint: {
          ok: result.endpoint.ok,
          message: result.endpoint.message,
          detail: result.endpoint.detail,
          latency: result.endpoint.latency,
        },
        jsonValidation: {
          ok: result.jsonValidation.ok,
          message: result.jsonValidation.message,
          detail: result.jsonValidation.detail,
          latency: result.jsonValidation.latency,
        },
      },
      overall: {
        httpStatus: result.overall.httpStatus,
        latency: result.overall.latency,
        timestamp: result.overall.timestamp,
      },
    });
  } catch (error) {
    console.error('[MarketplaceTestV2] Error:', error);
    return res.status(500).json({
      ok: false,
      message: 'Test sirasinda hata olustu',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
});
