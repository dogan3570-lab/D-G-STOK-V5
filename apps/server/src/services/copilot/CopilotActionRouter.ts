// ==================== COPILOT ACTION ROUTER V1 ====================
// Intent'e göre doğru servisi çağırır
// Yeni iş mantığı yok, mevcut servisleri yönlendirir
// ==================================================================

import { prisma } from '../../db/prisma.ts';
import type { IntentMatch, CopilotTaskInfo, TaskStatus, ModuleName } from './types.ts';
import { CopilotContext } from './CopilotContext.ts';

export class CopilotActionRouter {
  private context = new CopilotContext();

  /**
   * Intent'i işle, ilgili modülü çağır
   */
  async route(intent: IntentMatch): Promise<{
    answer: string;
    data?: any;
    tasks: CopilotTaskInfo[];
    requiresApproval: boolean;
  }> {
    const { module, action, params } = intent;

    switch (module) {
      case 'workflow':
        return this.handleWorkflow(action, params);
      case 'category':
        return this.handleCategory(action, params);
      case 'brand':
        return this.handleBrand(action, params);
      case 'variant':
        return this.handleVariant(action, params);
      case 'readyToSend':
        return this.handleReadyToSend(action);
      case 'aiImage':
        return this.handleAIImage(action);
      case 'aiSales':
        return this.handleAISales(action, params);
      case 'orders':
        return this.handleOrders(action);
      case 'marketplace':
        return this.handleMarketplace(action, params);
      case 'stockProtection':
        return this.handleStockProtection(action);
      case 'aiCommandCenter':
        return this.handleAICommandCenter(action);
      case 'dashboard':
      default:
        return this.handleDashboard();
    }
  }

  private async handleWorkflow(action: string, params: any): Promise<any> {
    const ctx = await this.context.gatherContext(['workflow']);
    const ws = ctx.workflowState;

    if (action === 'findNotReady') {
      const notReady = ws.total - ws.ready;
      // Detaylı analiz
      const categoryMissing = await prisma.product.count({ where: { categoryMatch: false } });
      const brandMissing = await prisma.product.count({ where: { brandMatch: false } });
      const variantMissing = await prisma.product.count({ where: { variantMatch: false } });

      const answer = `Toplam ${ws.total} ürün, ${ws.ready} hazır, **${notReady} ürün hazır değil**.\n\nDetay:\n- Kategori eksik: ${categoryMissing}\n- Marka eksik: ${brandMissing}\n- Varyant eksik: ${variantMissing}\n- Bloke: ${ws.blocked || 0}`;

      return { answer, data: ws, tasks: [], requiresApproval: false };
    }

    if (action === 'findBlocked') {
      const blocked = ws.blocked || 0;
      const answer = `${blocked} ürün bloke durumda.`;
      return { answer, data: ws, tasks: [], requiresApproval: false };
    }

    const answer = `Workflow: ${ws.ready}/${ws.total} ürün hazır (${Math.round((ws.ready / ws.total) * 100)}%).`;
    return { answer, data: ws, tasks: [], requiresApproval: false };
  }

  private async handleCategory(action: string, params: any): Promise<any> {
    const missing = await prisma.product.count({ where: { categoryId: null } });

    if (action === 'findMissingCategory') {
      const answer = `**${missing} ürün** kategorisi eksik.`;
      return {
        answer,
        data: { missing },
        tasks: [],
        requiresApproval: false,
      };
    }

    if (action === 'fixCategory') {
      const task: CopilotTaskInfo = {
        id: crypto.randomUUID(),
        conversationId: '',
        module: 'category',
        action: 'fixCategory',
        description: `${missing} ürün için kategori düzeltilecek.`,
        status: 'PENDING',
        requiresApproval: true,
      };

      return {
        answer: `${missing} üründe kategori sorunu var. Düzeltme işlemi başlatılsın mı?`,
        data: { missing },
        tasks: [task],
        requiresApproval: true,
      };
    }

    return { answer: 'Kategori bilgisi alındı.', data: {}, tasks: [], requiresApproval: false };
  }

  private async handleBrand(action: string, params: any): Promise<any> {
    const missing = await prisma.product.count({ where: { brandId: null } });

    if (action === 'findMissingBrand') {
      return { answer: `**${missing} ürün** markası eksik.`, data: { missing }, tasks: [], requiresApproval: false };
    }

    if (action === 'fixBrand') {
      const task: CopilotTaskInfo = {
        id: crypto.randomUUID(), conversationId: '', module: 'brand',
        action: 'fixBrand', description: `${missing} ürün için marka düzeltilecek.`,
        status: 'PENDING', requiresApproval: true,
      };
      return { answer: `${missing} üründe marka sorunu var. Düzeltme başlatılsın mı?`, data: { missing }, tasks: [task], requiresApproval: true };
    }

    return { answer: 'Marka bilgisi alındı.', data: {}, tasks: [], requiresApproval: false };
  }

  private async handleVariant(action: string, params: any): Promise<any> {
    const missing = await prisma.product.count({ where: { variantMatch: false } });
    return { answer: `**${missing} ürün** varyantı eksik.`, data: { missing }, tasks: [], requiresApproval: false };
  }

  private async handleReadyToSend(action: string): Promise<any> {
    const ready = await prisma.product.count({ where: { status: 'READY' } });
    const notReady = await prisma.product.count({ where: { status: { not: 'READY' } } });
    return {
      answer: `**${ready} ürün** gönderime hazır. **${notReady} ürün** hazır değil.`,
      data: { ready, notReady },
      tasks: [],
      requiresApproval: false,
    };
  }

  private async handleAIImage(action: string): Promise<any> {
    const ctx = await this.context.gatherContext(['aiImage']);
    const img = ctx.aiImage;
    return {
      answer: `AI Görsel Merkezi:\n- Toplam analiz: ${img.total}\n- Filigran sorunu: ${img.watermarkIssues}\n- Beyaz fon sorunu: ${img.backgroundIssues}\n- Başarısız: ${img.failed}`,
      data: img,
      tasks: [],
      requiresApproval: false,
    };
  }

  private async handleAISales(action: string, params: any): Promise<any> {
    const ctx = await this.context.gatherContext(['aiSales']);
    const sales = ctx.aiSales;

    if (action === 'findLowProfit') {
      return {
        answer: `**${sales.priceUp} ürün** için fiyat artışı öneriliyor (düşük kar).`,
        data: sales,
        tasks: [],
        requiresApproval: false,
      };
    }

    if (action === 'suggestPriceUp') {
      return {
        answer: `**${sales.priceUp} ürün** fiyatı artırılabilir.\n\nAI önerisi: Stok azalan veya karı düşük ürünler.\nOnay alındıktan sonra fiyatlar güncellenebilir.`,
        data: sales,
        tasks: [],
        requiresApproval: false,
      };
    }

    if (action === 'suggestPriceDown') {
      return {
        answer: `**${sales.priceDown} ürün** fiyatı düşürülebilir.\n\nAI önerisi: Rakip baskısı veya yavaş satış olan ürünler.`,
        data: sales,
        tasks: [],
        requiresApproval: false,
      };
    }

    return { answer: `AI Satış: ${sales.total} rapor, ${sales.riskCount} riskli ürün.`, data: sales, tasks: [], requiresApproval: false };
  }

  private async handleOrders(action: string): Promise<any> {
    const ctx = await this.context.gatherContext(['orders']);
    const orders = ctx.orders;

    if (action === 'todaySummary') {
      return {
        answer: `**Bugün ${orders.today} sipariş**. Toplam ${orders.total} sipariş.`,
        data: orders,
        tasks: [],
        requiresApproval: false,
      };
    }

    if (action === 'topSelling') {
      return {
        answer: `Bugün ${orders.today} sipariş alındı. Detaylı rapor için lütfen Siparişler sayfasını ziyaret edin.`,
        data: orders,
        tasks: [],
        requiresApproval: false,
      };
    }

    return { answer: `Toplam ${orders.total} sipariş, bugün ${orders.today} yeni.`, data: orders, tasks: [], requiresApproval: false };
  }

  private async handleMarketplace(action: string, params: any): Promise<any> {
    const question = (params.question || '').toLowerCase();
    let marketplaceName = 'Trendyol';

    if (question.includes('hepsiburada')) marketplaceName = 'Hepsiburada';
    else if (question.includes('n11')) marketplaceName = 'N11';
    else if (question.includes('amazon')) marketplaceName = 'Amazon';
    else if (question.includes('pazarama')) marketplaceName = 'Pazarama';

    const ctx = await this.context.gatherContext(['aiImage', 'aiSales', 'workflow']);
    const ws = ctx.workflowState;
    const img = ctx.aiImage;
    const sales = ctx.aiSales;

    return {
      answer: `**${marketplaceName} Analizi:**\n- Workflow: ${ws.ready}/${ws.total} ürün hazır\n- Görsel sorunu: ${img.watermarkIssues + img.backgroundIssues}\n- Fiyat önerisi: ${sales.priceUp} artır, ${sales.priceDown} düşür\n- Riskli ürün: ${sales.riskCount}`,
      data: { marketplace: marketplaceName, ws, img, sales },
      tasks: [],
      requiresApproval: false,
    };
  }

  private async handleStockProtection(action: string): Promise<any> {
    const ctx = await this.context.gatherContext(['stockProtection']);
    return {
      answer: `**${ctx.stockProtection.lowStock} ürün** stok riski altında (stok ≤ 5).`,
      data: ctx.stockProtection,
      tasks: [],
      requiresApproval: false,
    };
  }

  private async handleAICommandCenter(action: string): Promise<any> {
    const ctx = await this.context.gatherContext(['aiCommandCenter']);
    const cc = ctx.aiCommandCenter;
    return {
      answer: `AI Command Center:\n- Toplam: ${cc.totalIssues} açık sorun\n- Kritik: ${cc.critical}\n- Yüksek: ${cc.high}`,
      data: cc,
      tasks: [],
      requiresApproval: false,
    };
  }

  private async handleDashboard(): Promise<any> {
    const ctx = await this.context.gatherContext();
    const d = ctx.dashboard;
    const ws = ctx.workflowState;
    const cc = ctx.aiCommandCenter;
    const orders = ctx.orders;

    return {
      answer: `**DG STOK V5.0 — Genel Durum**\n\n📦 **Ürünler:** ${d.totalProducts} toplam, ${d.readyProducts} hazır, ${d.errorProducts} hatalı\n📑 **Siparişler:** ${orders.total} toplam, bugün ${orders.today}\n🏪 **Pazaryeri:** ${d.totalMarketplaces}\n⚡ **Workflow:** ${ws.ready}/${ws.total} hazır\n🔴 **AI Sorun:** ${cc.totalIssues} açık (${cc.critical} kritik)\n💰 **AI Satış:** ${ctx.aiSales?.total || 0} rapor`,
      data: ctx,
      tasks: [],
      requiresApproval: false,
    };
  }
}
