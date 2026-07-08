import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth } from '../auth/authMiddleware.ts';
import { fetchXmlFromUrl, importXmlProducts } from '../services/xmlImport.ts';

const router = Router();

// GET /xml-sources - List all XML sources (suppliers)
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
      currency, vatRate, active, scheduleIntervalMinutes,
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
      currency, vatRate, active, scheduleIntervalMinutes,
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

// POST /xml-sources/:id/sync - Manual sync trigger
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

    const xmlContent = await fetchXmlFromUrl(source.url);
    const result = await importXmlProducts(xmlContent, {
      sourceId: source.id,
      sourceName: source.name,
    });

    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      message: 'Sync completed',
      sourceId: source.id,
      importedCount: result.importedCount,
      updatedCount: result.updatedCount,
      totalItems: result.items.length,
      runId: result.runId,
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to trigger sync' } });
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
