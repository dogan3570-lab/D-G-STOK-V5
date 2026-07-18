export class AIResponseParser {
  parse(rawResponse: string): { success: boolean; data: any; error?: string } {
    try {
      // JSON parse dene
      const parsed = JSON.parse(rawResponse);
      return { success: true, data: parsed };
    } catch {
      // JSON degilse, temizle ve tekrar dene
      const cleaned = this.cleanResponse(rawResponse);
      try {
        const parsed = JSON.parse(cleaned);
        return { success: true, data: parsed };
      } catch {
        // Hicbir sekilde parse edilemezse raw string olarak gonder
        return { success: false, data: rawResponse, error: 'JSON parse hatasi' };
      }
    }
  }

  private cleanResponse(text: string): string {
    return text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^\s*[\r\n]/gm, '')
      .trim();
  }

  extractField(data: any, field: string, defaultValue: any = null): any {
    if (!data || typeof data !== 'object') return defaultValue;
    
    const keys = field.split('.');
    let current = data;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current !== undefined ? current : defaultValue;
  }

  getConfidence(data: any): number {
    return this.extractField(data, 'confidence', 0);
  }

  getSuggestion(data: any): string {
    return this.extractField(data, 'suggestion', 'Oneri bulunamadi');
  }

  isFixable(data: any): boolean {
    return this.extractField(data, 'fixable', false);
  }
}
