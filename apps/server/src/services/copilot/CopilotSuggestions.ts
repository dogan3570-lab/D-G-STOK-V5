// ==================== COPILOT SUGGESTIONS V1 ====================
// Kullanıcıya bağlama göre öneriler sunar
// ================================================================

import { CopilotHistory } from './CopilotHistory.ts';

export class CopilotSuggestions {
  private history = new CopilotHistory();

  /**
   * Önerileri getir (en çok kullanılan + varsayılan)
   */
  async getSuggestions(limit = 6): Promise<string[]> {
    const topCommands = await this.history.getTopCommands(5);
    const defaultSuggestions = [
      'Hazır olmayan ürünleri göster',
      'Kategori eksik ürünleri bul',
      'Görsel problemi olanları göster',
      'Trendyol\'u analiz et',
      'Bugün satışlar nasıl?',
      'Karı düşük ürünleri göster',
      'Fiyatı artırılabilecek ürünleri bul',
      'Stok riski olan ürünleri göster',
      'Siparişleri analiz et',
      'Genel durumu göster',
    ];

    // En çok kullanılanları önce göster
    const popular = topCommands.map(c => c.question);
    const combined = [...popular, ...defaultSuggestions.filter(s => !popular.includes(s))];

    return combined.slice(0, limit);
  }
}
