// ==================== COPILOT PROMPT BUILDER V1 ====================
// Kullanıcıya gösterilecek yanıt metnini oluşturur
// ==================================================================

import type { ContextData } from './types.ts';

export class CopilotPromptBuilder {
  /**
   * Bağlam verisini okunabilir metne dönüştür
   */
  buildContextSummary(context: ContextData): string {
    const parts: string[] = [];

    if (context.dashboard) {
      const d = context.dashboard;
      parts.push(`📊 **Dashboard:** ${d.totalProducts} ürün, ${d.readyProducts} hazır, ${d.totalOrders} sipariş`);
    }
    if (context.workflowState) {
      const w = context.workflowState;
      parts.push(`⚡ **Workflow:** ${w.ready}/${w.total} hazır (${w.blocked || 0} bloke)`);
    }
    if (context.aiCommandCenter) {
      const c = context.aiCommandCenter;
      parts.push(`🔴 **AI Command:** ${c.totalIssues} sorun (${c.critical} kritik)`);
    }
    if (context.aiImage) {
      const i = context.aiImage;
      parts.push(`🖼️ **AI Görsel:** ${i.total} analiz, ${i.watermarkIssues} filigran sorunu`);
    }
    if (context.aiSales) {
      const s = context.aiSales;
      parts.push(`💰 **AI Satış:** ${s.total} rapor, ${s.riskCount} riskli`);
    }
    if (context.orders) {
      const o = context.orders;
      parts.push(`📑 **Sipariş:** ${o.total} toplam, bugün ${o.today}`);
    }

    return parts.join('\n');
  }
}
