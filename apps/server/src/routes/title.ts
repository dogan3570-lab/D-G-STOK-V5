import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.ts';
import { requireAuth, requireRole, type AuthedRequest } from '../auth/authMiddleware.ts';
import { generateTitle, bulkGenerateTitle } from '../services/titleEngine.ts';

const router = Router();

const VARIABLES_LIST = [
  { key: '{BRAND}', label: 'Marka', desc: 'DG STOK marka adı' },
  { key: '{PRODUCT_NAME}', label: 'Ürün Adı', desc: 'Orijinal XML başlığı' },
  { key: '{CATEGORY}', label: 'Kategori', desc: 'Kategori adı' },
  { key: '{SUBCATEGORY}', label: 'Alt Kategori', desc: 'Üst kategori adı' },
  { key: '{COLOR}', label: 'Renk', desc: 'Renk varyantı / tespiti' },
  { key: '{SIZE}', label: 'Beden/Numara', desc: 'Beden veya numara' },
  { key: '{GENDER}', label: 'Cinsiyet', desc: 'Erkek/Kadın/Unisex' },
  { key: '{MATERIAL}', label: 'Materyal', desc: 'Ürün materyali' },
  { key: '{SKU}', label: 'SKU', desc: 'Stok kodu' },
  { key: '{BARCODE}', label: 'Barkod', desc: 'Barkod numarası' },
  { key: '{XML_BRAND}', label: 'XML Markası', desc: 'XML kaynağındaki marka' },
  { key: '{CUSTOM_TEXT}', label: 'Özel Metin', desc: 'Kullanıcının girdiği metin' },
];

// GET /title/variables - Değişken listesi
router.get('/variables', (_req: Request, res: Response) => res.json({ items: VARIABLES_LIST }));

// GET /title/templates - Tüm şablonlar
router.get('/templates', requireAuth, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.titleTemplate.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
    res.json({ items });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Şablonlar alınamadı' } }); }
});

router.post('/templates', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { name, template, xmlSourceId, brandId, categoryId, marketplaceId, priority, maxLength } = req.body;
    if (!name || !template) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name ve template zorunludur' } });
    const item = await prisma.titleTemplate.create({ data: { name, template, xmlSourceId: xmlSourceId || null, brandId: brandId || null, categoryId: categoryId || null, marketplaceId: marketplaceId || null, priority: priority || 0, maxLength: maxLength || null } });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Şablon oluşturulamadı' } }); }
});

router.put('/templates/:id', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { name, template, xmlSourceId, brandId, categoryId, marketplaceId, isActive, priority, maxLength } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name; if (template !== undefined) data.template = template;
    if (xmlSourceId !== undefined) data.xmlSourceId = xmlSourceId || null; if (brandId !== undefined) data.brandId = brandId || null;
    if (categoryId !== undefined) data.categoryId = categoryId || null; if (marketplaceId !== undefined) data.marketplaceId = marketplaceId || null;
    if (isActive !== undefined) data.isActive = isActive; if (priority !== undefined) data.priority = priority;
    if (maxLength !== undefined) data.maxLength = maxLength || null;
    const item = await prisma.titleTemplate.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Şablon güncellenemedi' } }); }
});

router.delete('/templates/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try { await prisma.titleTemplate.delete({ where: { id: req.params.id } }); res.status(204).send(); }
  catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Şablon silinemedi' } }); }
});

// POST /title/generate - Başlık oluştur (tek ürün)
router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, template, customText, marketplaceKey } = req.body;
    if (!productId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productId required' } });
    const result = await generateTitle(productId, template, customText, marketplaceKey);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// POST /title/bulk - Toplu başlık oluştur
router.post('/bulk', requireAuth, requireRole(['ADMIN', 'OPERATOR']), async (req: Request, res: Response) => {
  try {
    const { productIds, allProducts, xmlSourceId, template, marketplaceKey } = req.body;
    let ids = productIds;
    if (allProducts || xmlSourceId) {
      const products = await prisma.product.findMany({ where: xmlSourceId ? { xmlSourceId } : {}, select: { id: true } });
      ids = products.map(p => p.id);
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'productIds required' } });
    const result = await bulkGenerateTitle(ids, template, marketplaceKey);
    res.json(result);
  } catch (error: any) { res.status(500).json({ error: { code: 'ERROR', message: error.message } }); }
});

// Forbidden words
router.get('/forbidden-words', requireAuth, async (_req: Request, res: Response) => {
  try { const items = await prisma.forbiddenWord.findMany({ orderBy: { word: 'asc' } }); res.json({ items }); }
  catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Yasak kelimeler alınamadı' } }); }
});

router.post('/forbidden-words', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { word, marketplaces } = req.body;
    if (!word) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'word required' } });
    const item = await prisma.forbiddenWord.create({ data: { word: word.toLowerCase().trim(), marketplaces: marketplaces ? JSON.stringify(marketplaces) : null } });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Yasak kelime eklenemedi' } }); }
});

router.delete('/forbidden-words/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try { await prisma.forbiddenWord.delete({ where: { id: req.params.id } }); res.status(204).send(); }
  catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Yasak kelime silinemedi' } }); }
});

// Marketplace configs
router.get('/marketplace-configs', requireAuth, async (_req: Request, res: Response) => {
  try {
    let configs = await prisma.marketplaceTitleConfig.findMany({ orderBy: { key: 'asc' } });
    if (configs.length === 0) {
      const defaults = [
        { key: 'trendyol', name: 'Trendyol', maxLength: 100, seoMaxLength: 70 },
        { key: 'amazon', name: 'Amazon', maxLength: 200, seoMaxLength: 80 },
        { key: 'n11', name: 'N11', maxLength: 150, seoMaxLength: 70 },
        { key: 'hepsiburada', name: 'Hepsiburada', maxLength: 150, seoMaxLength: 70 },
      ];
      for (const d of defaults) await prisma.marketplaceTitleConfig.upsert({ where: { key: d.key }, update: d, create: d });
      configs = await prisma.marketplaceTitleConfig.findMany({ orderBy: { key: 'asc' } });
    }
    res.json({ items: configs });
  } catch (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: 'Pazaryeri konfigürasyonları alınamadı' } }); }
});

export default router;
