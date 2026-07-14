import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import { fetchXmlFromUrl, importXmlProducts, parseXmlImportPayload, cancelSync, isSyncLocked } from '../services/xmlImport.ts';

const router = Router();

// GET /xml-sources - List all XML sources (suppliers) with stats
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const sources = await prisma.xmlSource.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const items = await Promise.all(sources.map(async (source) => {
      // Ürün sayısını xmlSourceId üzerinden doğrudan hesapla (kalıcı saklama)
      const productCount = await prisma.product.count({
        where: { xmlSourceId: source.id },
      });

      // Son import run istatistiklerini al
      const lastRun = await prisma.xmlImportRun.findFirst({
        where: { sourceId: source.id },
        orderBy: { startedAt: 'desc' },
        select: {
          status: true,
          newProducts: true,
          updatedProducts: true,
          failedProducts: true,
          durationMs: true,
          finishedAt: true,
          startedAt: true,
        },
      });

      return {
        id: source.id,
        name: source.name,
        company: source.company,
        sourceType: source.sourceType,
        url: source.url,
        username: source.username,
        currency: source.currency,
        vatRate: source.vatRate,
        active: source.active,
        connectionStatus: source.connectionStatus,
        scheduleIntervalMinutes: source.scheduleIntervalMinutes,
        lastRunAt: source.lastRunAt,
        lastSuccessAt: source.lastSuccessAt,
        lastError: source.lastError,
        purchasePriceVatStatus: source.purchasePriceVatStatus,
        purchasePriceField: source.purchasePriceField,
        productCount,
        // Son çalışma istatistikleri
        lastRunStatus: lastRun?.status ?? null,
        lastRunDurationMs: lastRun?.durationMs ?? null,
        lastNewProducts: lastRun?.newProducts ?? 0,
        lastUpdatedProducts: lastRun?.updatedProducts ?? 0,
        lastFailedProducts: lastRun?.failedProducts ?? 0,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      };
    }));

    res.json({ items });
  } catch (error) {
    console.error('Error fetching XML sources:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XML sources' } });
  }
});

// GET /xml-sources/:id - Get single XML source with full details
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({
      where: { id },
      include: {
        importRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    res.json(source);
  } catch (error) {
    console.error('Error fetching XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XML source' } });
  }
});

// POST /xml-sources - Create new XML source (supplier)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name, company, sourceType, url, username, password,
      currency, vatRate, active, scheduleIntervalMinutes, cronExpression,
      purchasePriceVatStatus, purchasePriceField,
      updateStock, updatePrice, updateImages
    } = req.body;

    if (!name || !sourceType) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name and sourceType are required' } });
    }

    const source = await prisma.xmlSource.create({
      data: {
        name,
        company: company || null,
        sourceType,
        url: url || null,
        username: username || null,
        password: password || null,
        currency: currency || 'TRY',
        vatRate: vatRate != null ? Number(vatRate) : 20,
        active: active !== false,
        scheduleIntervalMinutes: scheduleIntervalMinutes || 60,
        cronExpression: cronExpression || null,
        purchasePriceVatStatus: purchasePriceVatStatus || 'dahil',
        purchasePriceField: purchasePriceField || null,
        updateStock: updateStock !== false,
        updatePrice: updatePrice !== false,
        updateImages: updateImages !== false,
        connectionStatus: url ? 'unknown' : 'connected',
      },
    });

    res.status(201).json(source);
  } catch (error) {
    console.error('Error creating XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create XML source' } });
  }
});

// PUT /xml-sources/:id - Update XML source
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name, company, sourceType, url, username, password,
      currency, vatRate, active, scheduleIntervalMinutes, cronExpression,
      purchasePriceVatStatus, purchasePriceField,
      updateStock, updatePrice, updateImages,
      fieldMapping, pricingRules
    } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (company !== undefined) data.company = company;
    if (sourceType !== undefined) data.sourceType = sourceType;
    if (url !== undefined) data.url = url;
    if (username !== undefined) data.username = username;
    if (password !== undefined) data.password = password;
    if (currency !== undefined) data.currency = currency;
    if (vatRate !== undefined) data.vatRate = Number(vatRate);
    if (active !== undefined) data.active = active;
    if (scheduleIntervalMinutes !== undefined) data.scheduleIntervalMinutes = scheduleIntervalMinutes;
    if (cronExpression !== undefined) data.cronExpression = cronExpression;
    if (purchasePriceVatStatus !== undefined) data.purchasePriceVatStatus = purchasePriceVatStatus;
    if (purchasePriceField !== undefined) data.purchasePriceField = purchasePriceField;
    if (updateStock !== undefined) data.updateStock = updateStock;
    if (updatePrice !== undefined) data.updatePrice = updatePrice;
    if (updateImages !== undefined) data.updateImages = updateImages;
    if (fieldMapping !== undefined) data.fieldMapping = typeof fieldMapping === 'string' ? fieldMapping : JSON.stringify(fieldMapping);
    if (pricingRules !== undefined) data.pricingRules = typeof pricingRules === 'string' ? pricingRules : JSON.stringify(pricingRules);

    const source = await prisma.xmlSource.update({
      where: { id },
      data,
    });

    res.json(source);
  } catch (error) {
    console.error('Error updating XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update XML source' } });
  }
});

// DELETE /xml-sources/:id - Delete XML source
// Ürünler silinmez, veritabanında kalıcı olarak saklanır
// Kullanıcı XML kaynağını kaldırana kadar ürünler durur
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Sadece import kayıtlarını temizle, ürünleri silme
    await prisma.xmlImportItemResult.deleteMany({
      where: { importRun: { sourceId: id } },
    });
    await prisma.xmlImportRun.deleteMany({ where: { sourceId: id } });
    
    // Ürünlerin xmlSourceId bağlantısını kaldır (ama ürünleri silme)
    await prisma.product.updateMany({
      where: { xmlSourceId: id },
      data: { xmlSourceId: null },
    });
    
    await prisma.xmlSource.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete XML source' } });
  }
});

// POST /xml-sources/:id/test - Test XML connection
router.post('/:id/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({ where: { id } });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    if (!source.url) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Source URL is required for testing' } });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(source.url, { 
        signal: controller.signal,
        redirect: 'follow',
        headers: source.username ? {
          'Authorization': 'Basic ' + Buffer.from(`${source.username}:${source.password || ''}`).toString('base64')
        } : undefined,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        const hasContent = text.trim().length > 0;
        const hasXmlTags = text.includes('<') && text.includes('>');

        await prisma.xmlSource.update({
          where: { id },
          data: { 
            connectionStatus: hasContent && hasXmlTags ? 'connected' : 'error',
            lastError: hasContent && hasXmlTags ? null : 'XML içeriği bulunamadı veya geçersiz XML formatı'
          },
        });

        res.json({ 
          ok: true, 
          status: 'connected',
          message: hasContent && hasXmlTags ? 'Bağlantı başarılı, XML içeriği geçerli' : 'Bağlantı başarılı ancak XML içeriği sorunlu',
          contentLength: text.length,
        });
      } else if (response.status === 401 || response.status === 403) {
        await prisma.xmlSource.update({
          where: { id },
          data: { connectionStatus: 'auth_error', lastError: 'Kimlik doğrulama hatası' },
        });
        res.json({ ok: false, status: 'auth_error', message: 'Kimlik doğrulama hatası' });
      } else {
        await prisma.xmlSource.update({
          where: { id },
          data: { connectionStatus: 'error', lastError: `HTTP ${response.status}` },
        });
        res.json({ ok: false, status: 'error', message: `HTTP ${response.status} hatası` });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bağlantı hatası';
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
      
      await prisma.xmlSource.update({
        where: { id },
        data: { 
          connectionStatus: isTimeout ? 'timeout' : 'error',
          lastError: isTimeout ? 'Zaman aşımı (15sn)' : errorMessage
        },
      });

      res.json({ 
        ok: false, 
        status: isTimeout ? 'timeout' : 'error', 
        message: isTimeout ? 'Zaman aşımı' : errorMessage 
      });
    }
  } catch (error) {
    console.error('Error testing XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to test XML source' } });
  }
});

// POST /xml-sources/:id/analyze - Detaylı XML analizi (ürün, kategori, marka, varyant, resim sayısı)
router.post('/:id/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({ where: { id } });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    if (!source.url) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Source URL is required for analysis' } });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(source.url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: source.username ? {
          'Authorization': 'Basic ' + Buffer.from(`${source.username}:${source.password || ''}`).toString('base64')
        } : undefined,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(400).json({ ok: false, message: `HTTP ${response.status} hatası` });
      }

      const text = await response.text();
      const contentLength = text.length;
      const encoding = detectEncoding(text);

      // parseXmlImportPayload kullanarak ürünleri parse et
      const products = parseXmlImportPayload(text);

      // İstatistikleri çıkar
      const categorySet = new Set<string>();
      const brandSet = new Set<string>();
      const variantCounts: Record<string, number> = {};
      let imageCount = 0;
      let hasXmlKey = 0;

      for (const product of products) {
        if (product.xmlKey) hasXmlKey++;
        
        // Kategoriler
        const parts = [product.topCategory, product.mainCategory, product.subCategory, product.category].filter(Boolean);
        if (parts.length > 0) categorySet.add(parts.join(' > '));
        
        // Markalar
        if (product.brand) brandSet.add(product.brand);
        
        // Varyant
        const variantType = product.sku?.includes('-') ? 'SKU-tabanlı' : 'Yok';
        if (product.sku?.includes('-')) {
          variantCounts[variantType] = (variantCounts[variantType] || 0) + 1;
        }
        
        // Resimler
        if (product.images) {
          imageCount += product.images.split(',').filter(Boolean).length;
        }
      }

      // URL'leri doğrula
      const imageUrls = products.flatMap(p => p.images ? p.images.split(',').filter(Boolean) : []);
      const validUrls = imageUrls.filter(u => u.startsWith('https'));
      const httpUrls = imageUrls.filter(u => u.startsWith('http://'));
      const invalidUrls = imageUrls.filter(u => !u.startsWith('http'));

      // XML yapısal analiz
      const totalTags = (text.match(/<[^>]+>/g) || []).length;
      const hasCDATA = text.includes('<![CDATA[');
      const hasHtmlEntities = /&[a-z]+;/i.test(text);
      const productTagCount = (text.match(/<(product|item)\b[^>]*>/gi) || []).length;

      res.json({
        ok: true,
        analysis: {
          // Dosya bilgisi
          contentLength,
          contentLengthFormatted: formatFileSize(contentLength),
          encoding,
          totalTags,
          hasCDATA,
          hasHtmlEntities,
          validXml: true,
          
          // Ürün istatistikleri
          totalProducts: products.length,
          productTagsFound: productTagCount,
          productsWithXmlKey: hasXmlKey,
          productsWithoutXmlKey: products.length - hasXmlKey,
          
          // Kategori/Marka/Varyant
          uniqueCategories: categorySet.size,
          categoryList: Array.from(categorySet).slice(0, 20),
          uniqueBrands: brandSet.size,
          brandList: Array.from(brandSet).slice(0, 20),
          variantSummary: Object.keys(variantCounts).length > 0 ? variantCounts : 'Varyant bulunamadı',
          
          // Resim
          totalImages: imageCount,
          uniqueImageUrls: imageUrls.length,
          httpsUrls: validUrls.length,
          httpUrls: httpUrls.length,
          invalidUrls: invalidUrls.length,
        },
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        message: 'XML analiz edilemedi',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    console.error('Error analyzing XML source:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze XML source' } });
  }
});

function detectEncoding(text: string): string {
  // Basit encoding tespiti
  if (text.startsWith('\uFEFF')) return 'UTF-8 BOM';
  const encodingMatch = text.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i);
  if (encodingMatch) return encodingMatch[1];
  // UTF-8 kontrolü
  try {
    Buffer.from(text, 'utf-8');
    return 'UTF-8';
  } catch {
    return 'Unknown';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Arka planda sync çalıştır
async function runSyncInBackground(sourceId: string, sourceUrl: string, sourceName: string) {
  try {
    console.log(`[Background Sync] Starting for ${sourceName}...`);
    const xmlContent = await fetchXmlFromUrl(sourceUrl);
    const result = await importXmlProducts(xmlContent, {
      sourceId,
      sourceName,
    });
    console.log(`[Background Sync] Completed for ${sourceName}: ${result.importedCount} imported, ${result.updatedCount} updated`);
  } catch (error) {
    console.error(`[Background Sync] Error for ${sourceName}:`, error);
  }
}

// POST /xml-sources/:id/sync - Manual sync trigger (arka planda çalışır)
router.post('/:id/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({ where: { id } });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    if (!source.url) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Source URL is required for sync' } });
    }

    // Arka planda çalıştır (HTTP timeout olmaması için)
    runSyncInBackground(source.id, source.url, source.name).catch(console.error);

    res.json({
      message: 'Sync started in background',
      sourceId: source.id,
      status: 'running',
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to trigger sync' } });
  }
});

// POST /xml-sources/sync-all - Batch sync all active XML sources
router.post('/sync-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const activeSources = await prisma.xmlSource.findMany({
      where: { active: true, url: { not: null } },
      select: { id: true, name: true, url: true },
    });

    if (activeSources.length === 0) {
      return res.json({ message: 'Aktif XML kaynağı bulunamadı', total: 0, started: 0 });
    }

    let startedCount = 0;
    for (const source of activeSources) {
      if (source.url) {
        runSyncInBackground(source.id, source.url, source.name).catch(console.error);
        startedCount++;
      }
    }

    res.json({
      message: `${startedCount}/${activeSources.length} aktif XML kaynağı için sync başlatıldı`,
      total: activeSources.length,
      started: startedCount,
    });
  } catch (error) {
    console.error('Error triggering batch sync:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to trigger batch sync' } });
  }
});

// POST /xml-sources/:id/cancel - Cancel a running sync
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({ where: { id } });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    if (!isSyncLocked(id)) {
      return res.json({ message: 'Bu kaynak için aktif bir senkronizasyon bulunamadı', cancelled: false });
    }

    const cancelled = cancelSync(id);
    // Import run'ı güncelle
    await prisma.xmlImportRun.updateMany({
      where: { sourceId: id, status: 'running' },
      data: { status: 'cancelled', finishedAt: new Date() },
    });

    res.json({
      message: cancelled ? 'Senkronizasyon iptal edildi' : 'İptal başarısız',
      cancelled,
    });
  } catch (error) {
    console.error('Error cancelling sync:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel sync' } });
  }
});

// GET /xml-sources/:id/history - Get sync history
router.get('/:id/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const runs = await prisma.xmlImportRun.findMany({
      where: { sourceId: id },
      orderBy: { startedAt: 'desc' },
      take: Number(limit),
    });

    res.json({ items: runs });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sync history' } });
  }
});

// GET /xml-sources/:id/fields - Get XML field analysis
router.get('/:id/fields', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await prisma.xmlSource.findUnique({ where: { id } });

    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    if (!source.url) {
      return res.json({ fields: [], mapping: null });
    }

    try {
      const xmlContent = await fetchXmlFromUrl(source.url);
      
      // XML'deki tüm tag'leri bul
      const tagRegex = /<([A-Za-z_][\w:.-]*)\b[^>]*>/g;
      const tags = new Set<string>();
      let match;
      while ((match = tagRegex.exec(xmlContent)) !== null) {
        tags.add(match[1]);
      }

      // Ürün içindeki alanları bul
      const productRegex = /<(product|item)\b[^>]*>([\s\S]*?)<\/\1>/i;
      const productMatch = productRegex.exec(xmlContent);
      let productFields: string[] = [];
      
      if (productMatch) {
        const productContent = productMatch[2];
        const fieldRegex = /<([A-Za-z_][\w:.-]*)\b[^>]*>/g;
        const fieldSet = new Set<string>();
        while ((match = fieldRegex.exec(productContent)) !== null) {
          fieldSet.add(match[1]);
        }
        productFields = Array.from(fieldSet);
      }

      // Mevcut eşleştirmeyi al
      let mapping: Record<string, string> = {};
      if (source.fieldMapping) {
        try { mapping = JSON.parse(source.fieldMapping); } catch {}
      }

      res.json({ 
        fields: productFields,
        allTags: Array.from(tags),
        mapping,
        purchasePriceField: source.purchasePriceField,
      });
    } catch (error) {
      res.json({ 
        fields: [], 
        allTags: [],
        mapping: null,
        error: 'XML alınamadı',
      });
    }
  } catch (error) {
    console.error('Error analyzing XML fields:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze XML fields' } });
  }
});

// PUT /xml-sources/:id/mapping - Save field mapping
router.put('/:id/mapping', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fieldMapping, purchasePriceField } = req.body;

    const data: Record<string, unknown> = {};
    if (fieldMapping !== undefined) {
      data.fieldMapping = typeof fieldMapping === 'string' ? fieldMapping : JSON.stringify(fieldMapping);
    }
    if (purchasePriceField !== undefined) {
      data.purchasePriceField = purchasePriceField;
    }

    const source = await prisma.xmlSource.update({
      where: { id },
      data,
    });

    res.json({ ok: true, source });
  } catch (error) {
    console.error('Error saving field mapping:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save field mapping' } });
  }
});

// PUT /xml-sources/:id/pricing - Save pricing rules
router.put('/:id/pricing', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pricingRules, purchasePriceVatStatus, vatRate } = req.body;

    const data: Record<string, unknown> = {};
    if (pricingRules !== undefined) {
      data.pricingRules = typeof pricingRules === 'string' ? pricingRules : JSON.stringify(pricingRules);
    }
    if (purchasePriceVatStatus !== undefined) data.purchasePriceVatStatus = purchasePriceVatStatus;
    if (vatRate !== undefined) data.vatRate = Number(vatRate);

    const source = await prisma.xmlSource.update({
      where: { id },
      data,
    });

    res.json({ ok: true, source });
  } catch (error) {
    console.error('Error saving pricing rules:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save pricing rules' } });
  }
});

// POST /xml-sources/:id/pricing/preview - Preview pricing calculation
router.post('/:id/pricing/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { purchasePrice, pricingRules, purchasePriceVatStatus, vatRate } = req.body;

    const source = await prisma.xmlSource.findUnique({ where: { id } });
    if (!source) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'XML source not found' } });
    }

    const rules = pricingRules || (source.pricingRules ? JSON.parse(source.pricingRules) : []);
    const vatStatus = purchasePriceVatStatus || source.purchasePriceVatStatus;
    const vat = vatRate != null ? Number(vatRate) : source.vatRate;
    const basePrice = Number(purchasePrice) || 0;

    // KDV hesaplama
    let calculatedPrice = basePrice;
    if (vatStatus === 'haric') {
      calculatedPrice = basePrice * (1 + vat / 100);
    }
    // 'dahil' veya 'ekleme' durumunda olduğu gibi kullan

    // Fiyatlandırma kurallarını uygula
    let stepIndex = 0;
    const steps: Array<{ step: number; rule: string; before: number; after: number }> = [];

    if (Array.isArray(rules)) {
      for (const rule of rules) {
        stepIndex++;
        const before = calculatedPrice;
        
        switch (rule.type) {
          case 'fixed_add':
            calculatedPrice += Number(rule.value) || 0;
            break;
          case 'fixed_subtract':
            calculatedPrice -= Number(rule.value) || 0;
            break;
          case 'percentage_profit':
            calculatedPrice = calculatedPrice * (1 + (Number(rule.value) || 0) / 100);
            break;
          case 'percentage_discount':
            calculatedPrice = calculatedPrice * (1 - (Number(rule.value) || 0) / 100);
            break;
          case 'round_nearest':
            calculatedPrice = Math.round(calculatedPrice / Number(rule.value)) * Number(rule.value);
            break;
          case 'round_99':
            calculatedPrice = Math.floor(calculatedPrice) + 0.99;
            break;
          case 'round_999':
            calculatedPrice = Math.floor(calculatedPrice) + 0.90;
            break;
          case 'psychological':
            if (calculatedPrice >= 100) {
              const intPart = Math.floor(calculatedPrice);
              const lastDigit = intPart % 10;
              calculatedPrice = intPart - lastDigit + (lastDigit > 5 ? 9 : 9.90);
            }
            break;
          case 'min_price':
            calculatedPrice = Math.max(calculatedPrice, Number(rule.value) || 0);
            break;
          case 'max_price':
            calculatedPrice = Math.min(calculatedPrice, Number(rule.value) || Infinity);
            break;
        }

        steps.push({
          step: stepIndex,
          rule: rule.label || rule.type,
          before: Math.round(before * 100) / 100,
          after: Math.round(calculatedPrice * 100) / 100,
        });
      }
    }

    res.json({
      basePrice,
      vatStatus,
      vatRate: vat,
      calculatedPrice: Math.round(calculatedPrice * 100) / 100,
      steps,
    });
  } catch (error) {
    console.error('Error previewing pricing:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to preview pricing' } });
  }
});

// GET /xml-sources/:id/products - Get products imported from a specific XML source
// Ürünler xmlSourceId üzerinden doğrudan çekilir (kalıcı saklama)
router.get('/:id/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const search = String(req.query?.search ?? '').trim();
    const page = Math.max(1, Number(req.query?.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query?.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      xmlSourceId: id,
    };

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { xmlKey: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          variants: { select: { id: true, name: true, value: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const source = await prisma.xmlSource.findUnique({
      where: { id },
      select: { name: true, lastRunAt: true, lastSuccessAt: true },
    });

    res.json({
      items,
      source,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching source products:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch source products' } });
  }
});

export default router;
