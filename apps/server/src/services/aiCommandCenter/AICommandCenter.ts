// ==================== AI COMMAND CENTER V1 ====================
// DG STOK V5.0 - Tüm AI motorlarının tek merkezi
// ==============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';

type IssueType =
  'CATEGORY_MISSING' | 'BRAND_MISSING' | 'VARIANT_MISSING' | 'CONTENT_MISSING'
  | 'SEO_LOW' | 'IMAGE_LOW' | 'PRICE_RISK' | 'WORKFLOW_BLOCKED'
  | 'READY_TO_SEND_FAILED' | 'MARKETPLACE_ERROR' | 'XML_ERROR'
  | 'BARCODE_ERROR' | 'STOCK_ERROR';

export class AICommandCenter {

  static async scanProduct(productId: string) {
    const [product, ws, aiCheck, categorySuggestion] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.workflowState.findUnique({ where: { productId } }),
      prisma.aICheck.findUnique({ where: { productId } }),
      prisma.aICategorySuggestion.findFirst({ where: { productId }, orderBy: { confidence: 'desc' } }),
    ]);

    if (!product) return null;

    const issues: Array<{ type: IssueType; severity: string; priority: number; title: string; description: string; recommendedAction: string; confidence: number }> = [];

    // Kategori kontrolü
    if (!product.categoryId) {
      issues.push({
        type: 'CATEGORY_MISSING', severity: 'HIGH', priority: 1,
        title: 'Kategori Eksik', description: 'Ürün için kategori eşleştirmesi yapılmamış',
        recommendedAction: categorySuggestion?.suggestedCategory || 'Kategori önerisi al', confidence: categorySuggestion?.confidence || 0,
      });
    }

    // Marka kontrolü
    if (!product.brandId) {
      issues.push({
        type: 'BRAND_MISSING', severity: 'HIGH', priority: 1,
        title: 'Marka Eksik', description: 'Ürün için marka eşleştirmesi yapılmamış',
        recommendedAction: 'Marka önerisi al ve eşleştir', confidence: 0,
      });
    }

    // Varyant kontrolü
    const variantCount = await prisma.variant.count({ where: { productId } });
    if (variantCount === 0) {
      issues.push({
        type: 'VARIANT_MISSING', severity: 'HIGH', priority: 2,
        title: 'Varyant Eksik', description: 'Üründe hiç varyant bulunamadı',
        recommendedAction: 'Varyant analizi çalıştır', confidence: 0,
      });
    }

    // SEO kontrolü
    if (!product.seoTitle && !product.seoDescription) {
      issues.push({
        type: 'SEO_LOW', severity: 'MEDIUM', priority: 3,
        title: 'SEO Eksik', description: 'SEO başlık ve açıklama eksik',
        recommendedAction: 'SEO optimizasyonu çalıştır', confidence: 0,
      });
    }

    // Açıklama kontrolü
    if (!product.description || product.description.length < 50) {
      issues.push({
        type: 'CONTENT_MISSING', severity: 'MEDIUM', priority: 3,
        title: 'Açıklama Eksik', description: 'Ürün açıklaması çok kısa veya eksik',
        recommendedAction: 'Açıklama oluştur', confidence: 0,
      });
    }

    // Görsel kontrolü
    if (!product.images) {
      issues.push({
        type: 'IMAGE_LOW', severity: 'LOW', priority: 4,
        title: 'Görsel Eksik', description: 'Üründe hiç görsel bulunamadı',
        recommendedAction: 'Görsel ekle', confidence: 0,
      });
    }

    // Barkod kontrolü
    if (!product.barcode) {
      issues.push({
        type: 'BARCODE_ERROR', severity: 'LOW', priority: 4,
        title: 'Barkod Eksik', description: 'Ürün barkodu bulunamadı',
        recommendedAction: 'Barkod ekle', confidence: 0,
      });
    }

    // Stok kontrolü
    if (!product.stock || product.stock <= 0) {
      issues.push({
        type: 'STOCK_ERROR', severity: 'HIGH', priority: 2,
        title: 'Stok Tükendi', description: 'Ürün stoğu sıfır veya negatif',
        recommendedAction: 'Stok güncelle', confidence: 0,
      });
    }

    // Fiyat kontrolü
    if (!product.salePrice || product.salePrice <= 0) {
      issues.push({
        type: 'PRICE_RISK', severity: 'HIGH', priority: 2,
        title: 'Fiyat Eksik', description: 'Satış fiyatı belirtilmemiş',
        recommendedAction: 'Fiyat hesapla', confidence: 0,
      });
    }

    // Workflow kontrolü
    if (ws?.status !== 'READY') {
      issues.push({
        type: 'WORKFLOW_BLOCKED', severity: 'MEDIUM', priority: 3,
        title: 'Workflow Bloke', description: `Mevcut durum: ${ws?.status || 'BULUNAMADI'}`,
        recommendedAction: 'Workflow adımlarını tamamla', confidence: 0,
      });
    }

    // Issue'ları kaydet
    for (const issue of issues) {
      await prisma.aIIssue.create({
        data: {
          productId, module: issue.type.split('_')[0].toLowerCase(),
          type: issue.type, severity: issue.severity, priority: issue.priority,
          title: issue.title, description: issue.description,
          recommendedAction: issue.recommendedAction, confidence: issue.confidence,
        },
      });
    }

    const overallScore = Math.max(0, 100 - (issues.reduce((sum, i) => sum + (i.severity === 'CRITICAL' ? 25 : i.severity === 'HIGH' ? 15 : i.severity === 'MEDIUM' ? 10 : 5), 0)));

    return { productId, issues, totalIssues: issues.length, overallScore };
  }

  static async getDashboard() {
    const [total, critical, high, medium, low, resolved, byModule] = await Promise.all([
      prisma.aIIssue.count({ where: { resolved: false } }),
      prisma.aIIssue.count({ where: { resolved: false, severity: 'CRITICAL' } }),
      prisma.aIIssue.count({ where: { resolved: false, severity: 'HIGH' } }),
      prisma.aIIssue.count({ where: { resolved: false, severity: 'MEDIUM' } }),
      prisma.aIIssue.count({ where: { resolved: false, severity: 'LOW' } }),
      prisma.aIIssue.count({ where: { resolved: true, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.aIIssue.groupBy({ by: ['module'], _count: { module: true }, where: { resolved: false } }),
    ]);

    return { totalIssues: total, critical, high, medium, low, resolvedToday: resolved, byModule };
  }

  static async resolveIssue(issueId: string) {
    await prisma.aIIssue.update({ where: { id: issueId }, data: { resolved: true, resolvedAt: new Date() } });
    EventBus.emit({ type: 'DashboardRefresh', correlationId: createCorrelationId('API'), timestamp: new Date().toISOString(), source: 'AICommandCenter', data: { reason: 'issue_resolved', affectedProductIds: [] } });
    return { ok: true };
  }
}
