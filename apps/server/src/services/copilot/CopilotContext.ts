// ==================== COPILOT CONTEXT V1 ====================
// Mevcut modüllerden veri toplar, bağlam oluşturur
// Yeni iş mantığı yok, sadece mevcut servisleri okur
// ============================================================

import { prisma } from '../../db/prisma.ts';
import type { ContextData } from './types.ts';

export class CopilotContext {
  /**
   * Tüm modüllerden bağlam topla
   */
  async gatherContext(modules?: string[]): Promise<ContextData> {
    const context: ContextData = {};

    const requests: Array<Promise<void>> = [];

    if (!modules || modules.includes('dashboard')) {
      requests.push(this.loadDashboard(context));
    }
    if (!modules || modules.includes('workflow')) {
      requests.push(this.loadWorkflow(context));
    }
    if (!modules || modules.includes('aiCommandCenter')) {
      requests.push(this.loadAICommandCenter(context));
    }
    if (!modules || modules.includes('aiImage')) {
      requests.push(this.loadAIImage(context));
    }
    if (!modules || modules.includes('aiSales')) {
      requests.push(this.loadAISales(context));
    }
    if (!modules || modules.includes('orders')) {
      requests.push(this.loadOrders(context));
    }
    if (!modules || modules.includes('readyToSend')) {
      requests.push(this.loadReadyToSend(context));
    }
    if (!modules || modules.includes('stockProtection')) {
      requests.push(this.loadStockProtection(context));
    }

    await Promise.all(requests);
    return context;
  }

  private async loadDashboard(ctx: ContextData): Promise<void> {
    const [totalProducts, readyProducts, errorProducts, totalOrders, totalMarketplaces] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'READY' } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.order.count(),
      prisma.marketplace.count(),
    ]);
    ctx.dashboard = { totalProducts, readyProducts, errorProducts, totalOrders, totalMarketplaces };
  }

  private async loadWorkflow(ctx: ContextData): Promise<void> {
    const [total, ready, blocked, byStatus] = await Promise.all([
      prisma.workflowState.count(),
      prisma.workflowState.count({ where: { status: 'READY' } }),
      prisma.workflowState.count({ where: { status: 'BLOCKED' } }),
      prisma.workflowState.groupBy({ by: ['status'], _count: true }),
    ]);
    ctx.workflowState = { total, ready, blocked, byStatus };
  }

  private async loadAICommandCenter(ctx: ContextData): Promise<void> {
    const [totalIssues, critical, high, byModule] = await Promise.all([
      prisma.aIIssue.count({ where: { resolved: false } }),
      prisma.aIIssue.count({ where: { resolved: false, severity: 'CRITICAL' } }),
      prisma.aIIssue.count({ where: { resolved: false, severity: 'HIGH' } }),
      prisma.aIIssue.groupBy({ by: ['module'], _count: true, where: { resolved: false } }),
    ]);
    ctx.aiCommandCenter = { totalIssues, critical, high, byModule };
  }

  private async loadAIImage(ctx: ContextData): Promise<void> {
    const [total, failed, watermarkIssues, backgroundIssues] = await Promise.all([
      prisma.aIImageAnalysis.count(),
      prisma.aIImageAnalysis.count({ where: { status: 'FAILED' } }),
      prisma.aIImageIssue.count({ where: { issueType: 'WATERMARK' } }),
      prisma.aIImageIssue.count({ where: { issueType: 'BACKGROUND_ERROR' } }),
    ]);
    ctx.aiImage = { total, failed, watermarkIssues, backgroundIssues };
  }

  private async loadAISales(ctx: ContextData): Promise<void> {
    const [total, priceUp, priceDown, riskCount] = await Promise.all([
      prisma.aISalesReport.count(),
      prisma.aISalesReport.count({ where: { recommendation: { in: ['PRICE_UP', 'URGENT_PRICE_UP'] } } }),
      prisma.aISalesReport.count({ where: { recommendation: 'PRICE_DOWN' } }),
      prisma.aISalesReport.count({ where: { stockRisk: { in: ['HIGH', 'CRITICAL'] } } }),
    ]);
    ctx.aiSales = { total, priceUp, priceDown, riskCount };
  }

  private async loadOrders(ctx: ContextData): Promise<void> {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [total, today, byStatus] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.groupBy({ by: ['status'], _count: true }),
    ]);
    ctx.orders = { total, today, byStatus };
  }

  private async loadReadyToSend(ctx: ContextData): Promise<void> {
    const [ready, notReady, byMarketplace] = await Promise.all([
      prisma.product.count({ where: { status: 'READY' } }),
      prisma.product.count({ where: { status: { not: 'READY' } } }),
      prisma.productMarketplaceState.groupBy({ by: ['status'], _count: true }),
    ]);
    ctx.readyToSend = { ready, notReady, byMarketplace };
  }

  private async loadStockProtection(ctx: ContextData): Promise<void> {
    const lowStock = await prisma.product.count({ where: { stock: { lte: 5 } } });
    ctx.stockProtection = { lowStock };
  }
}
