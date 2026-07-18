export type AIModel = 'openai' | 'azure' | 'huggingface' | 'mock';

interface ModelResponse {
  success: boolean;
  data: any;
  error?: string;
  model: AIModel;
  latencyMs: number;
}

export class ModelConnector {
  private activeModel: AIModel = 'mock';

  setModel(model: AIModel): void {
    this.activeModel = model;
  }

  async send(prompt: string, module: string): Promise<ModelResponse> {
    const start = Date.now();
    return this.mockResponse(prompt, module, start);
  }

  private async mockResponse(_prompt: string, module: string, start: number): Promise<ModelResponse> {
    await new Promise(r => setTimeout(r, 50));

    const mockData: Record<string, any> = {
      ErrorAnalyzer: {
        analysis: 'Fiyat araligi disinda kalan urunlerde olusur.',
        suggestion: 'Min/max fiyat limitlerini kontrol edin.',
        confidence: 85,
        fixable: true,
        autoFix: 'Fiyati minimum alis fiyatina guncelle',
      },
      ForbiddenWordEngine: {
        analysis: 'Yasakli kelime tespit edildi.',
        suggestion: 'Alternatif kelime kullanin.',
        confidence: 95,
        alternatives: ['alternatif1', 'alternatif2'],
      },
      PreflightChecker: {
        analysis: 'Urun gonderime hazir.',
        suggestion: 'Preflight kontrolleri basarili.',
        confidence: 90,
        passed: true,
        score: 95,
      },
    };

    const response = mockData[module] || {
      analysis: 'Analiz yapilamadi.',
      suggestion: 'Manuel kontrol onerilir.',
      confidence: 50,
    };

    return {
      success: true,
      data: response,
      model: 'mock',
      latencyMs: Date.now() - start,
    };
  }
}
