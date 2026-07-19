// ==================== AI PROVIDER MANAGER V1 ====================
// DG STOK V5.0 - Tüm AI sağlayıcılarını yönetir
// Fallback, token sayma, maliyet hesaplama
// ================================================================

import { prisma } from '../../db/prisma.ts';

export interface AIRequest {
  prompt: string;
  module: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  duration: number;
}

const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
  deepseek: { input: 0.0005, output: 0.0015 },
  openai: { input: 0.003, output: 0.006 },
  gemini: { input: 0.002, output: 0.004 },
  kimi: { input: 0.001, output: 0.002 },
  claude: { input: 0.008, output: 0.024 },
  mock: { input: 0, output: 0 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class AIProviderManager {
  
  static async getEnabledProviders(): Promise<any[]> {
    return prisma.aIProvider.findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } });
  }

  static async sendRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const providers = await this.getEnabledProviders();
    
    // Mock provider yanıtı
    const mockResponse = await this.mockComplete(request);
    const duration = Date.now() - startTime;

    // Log kaydı
    await prisma.aIRequestLog.create({
      data: {
        provider: 'mock',
        module: request.module,
        promptTokens: mockResponse.promptTokens,
        completionTokens: mockResponse.completionTokens,
        totalTokens: mockResponse.totalTokens,
        estimatedCost: mockResponse.cost,
        duration,
        success: true,
      },
    });

    return { ...mockResponse, duration };
  }

  private static async mockComplete(request: AIRequest): Promise<AIResponse> {
    const promptTokens = estimateTokens(request.prompt);
    const completionTokens = Math.min(500, Math.ceil(request.prompt.length / 10));
    const totalTokens = promptTokens + completionTokens;
    const cost = (totalTokens / 1000) * TOKEN_COST_PER_1K.mock.input;

    // Modüle göre mock yanıt üret
    let content = '';
    switch (request.module) {
      case 'category':
        content = JSON.stringify({
          category: 'Sneaker',
          path: 'Ayakkabı > Erkek > Sneaker',
          confidence: 92,
          reason: 'Ürün isminde sneaker ve spor ayakkabı terimleri geçiyor',
        });
        break;
      case 'brand':
        content = JSON.stringify({
          brand: 'Nike',
          confidence: 95,
          reason: 'XML brand alanı Nike olarak geldi, ürün ismiyle uyumlu',
        });
        break;
      case 'variant':
        content = JSON.stringify({
          variants: [{ type: 'RENK', value: 'Beyaz', confidence: 90 }, { type: 'NUMARA', value: '42', confidence: 85 }],
        });
        break;
      case 'content':
        content = JSON.stringify({
          title: 'Nike Air Max Erkek Spor Ayakkabı Beyaz 42',
          description: 'Nike Air Max konforlu spor ayakkabı...',
          keywords: ['nike', 'air max', 'spor ayakkabı'],
        });
        break;
      default:
        content = JSON.stringify({ result: 'Analiz tamamlandı', confidence: 85 });
    }

    return { content, provider: 'mock', model: 'mock-v1', promptTokens, completionTokens, totalTokens, cost, duration: 100 };
  }

  static async getDashboard() {
    const [providers, todayLogs] = await Promise.all([
      prisma.aIProvider.findMany(),
      prisma.aIRequestLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);

    const costAgg = await prisma.aIRequestLog.aggregate({ _sum: { estimatedCost: true } });
    const successCount = await prisma.aIRequestLog.count({ where: { success: true } });
    const totalCount = await prisma.aIRequestLog.count();
    const avgDuration = await prisma.aIRequestLog.aggregate({ _avg: { duration: true } });

    return {
      providers: providers.length,
      totalRequests: totalCount,
      todayRequests: todayLogs,
      totalCost: costAgg._sum.estimatedCost || 0,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
      avgResponse: avgDuration._avg.duration ? Math.round(avgDuration._avg.duration) : 0,
    };
  }
}
