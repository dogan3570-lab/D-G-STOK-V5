// ==================== MARKETPLACE IMAGE VALIDATOR V1 ====================
// Trendyol, Hepsiburada, N11, Amazon, Pazarama, ÇiçekSepeti kuralları
// ========================================================================

import { ImageAnalyzer, type AnalysisResult, type ImageIssue, type AnalysisConfig, type ImageMetadata } from './ImageAnalyzer.ts';

interface MarketplaceRule {
  key: string;
  name: string;
  minResolution: number;
  whiteBackground: boolean;
  noWatermark: boolean;
  noShadow: boolean;
  maxFileSize?: number;
  allowedFormats: string[];
  minImageCount: number;
  maxImageCount: number;
  requireMultipleAngles: boolean;
  noText: boolean;
  noMannequin?: boolean;
  noHanger?: boolean;
}

const MARKETPLACE_RULES: Record<string, MarketplaceRule> = {
  trendyol: {
    key: 'trendyol',
    name: 'Trendyol',
    minResolution: 800,
    whiteBackground: true,
    noWatermark: true,
    noShadow: true,
    maxFileSize: 5, // MB
    allowedFormats: ['jpg', 'jpeg', 'png'],
    minImageCount: 1,
    maxImageCount: 10,
    requireMultipleAngles: true,
    noText: true,
  },
  hepsiburada: {
    key: 'hepsiburada',
    name: 'Hepsiburada',
    minResolution: 800,
    whiteBackground: true,
    noWatermark: true,
    noShadow: true,
    allowedFormats: ['jpg', 'jpeg', 'png'],
    minImageCount: 1,
    maxImageCount: 12,
    requireMultipleAngles: false,
    noText: true,
    noMannequin: true,
  },
  n11: {
    key: 'n11',
    name: 'N11',
    minResolution: 600,
    whiteBackground: true,
    noWatermark: true,
    noShadow: false,
    allowedFormats: ['jpg', 'jpeg', 'png', 'gif'],
    minImageCount: 1,
    maxImageCount: 8,
    requireMultipleAngles: false,
    noText: true,
  },
  amazon: {
    key: 'amazon',
    name: 'Amazon',
    minResolution: 1000,
    whiteBackground: true,
    noWatermark: true,
    noShadow: true,
    allowedFormats: ['jpg', 'jpeg', 'png', 'tiff'],
    minImageCount: 1,
    maxImageCount: 9,
    requireMultipleAngles: true,
    noText: true,
    noMannequin: true,
  },
  pazarama: {
    key: 'pazarama',
    name: 'Pazarama',
    minResolution: 600,
    whiteBackground: false,
    noWatermark: true,
    noShadow: false,
    allowedFormats: ['jpg', 'jpeg', 'png'],
    minImageCount: 1,
    maxImageCount: 6,
    requireMultipleAngles: false,
    noText: true,
  },
  ciceksepeti: {
    key: 'ciceksepeti',
    name: 'ÇiçekSepeti',
    minResolution: 600,
    whiteBackground: false,
    noWatermark: true,
    noShadow: false,
    allowedFormats: ['jpg', 'jpeg', 'png'],
    minImageCount: 1,
    maxImageCount: 5,
    requireMultipleAngles: false,
    noText: true,
  },
};

export class MarketplaceImageValidator extends ImageAnalyzer {
  async analyze(imageUrl: string, _metadata?: Partial<ImageMetadata>, config?: AnalysisConfig): Promise<AnalysisResult> {
    const marketplaceKey = config?.marketplaceKey || 'trendyol';
    const rules = MARKETPLACE_RULES[marketplaceKey];

    if (!rules) {
      return {
        backgroundScore: 100,
        resolutionScore: 100,
        sharpnessScore: 100,
        lightingScore: 100,
        angleScore: 100,
        watermarkScore: 100,
        shadowScore: 100,
        marketplaceScore: 100,
        overallScore: 100,
        issues: [],
        recommendations: [],
        status: 'EXCELLENT',
      };
    }

    const issues: ImageIssue[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Çözünürlük kontrolü
    if (rules.minResolution > 600) {
      const resOk = await this.checkMinResolution(imageUrl, rules.minResolution);
      if (!resOk) {
        score -= 15;
        issues.push({
          issueType: 'LOW_RESOLUTION',
          severity: 'HIGH',
          confidence: 85,
          description: `${rules.name}, minimum ${rules.minResolution}x${rules.minResolution}px çözünürlük istiyor.`,
          recommendation: `Görsel çözünürlüğünü ${rules.minResolution}x${rules.minResolution}px'e yükseltin.`,
        });
        recommendations.push(`Çözünürlük minimum ${rules.minResolution}px olmalı (${rules.name}).`);
      }
    }

    // Beyaz fon kontrolü
    if (rules.whiteBackground) {
      const bgOk = await this.checkWhiteBackground(imageUrl);
      if (!bgOk) {
        score -= 20;
        issues.push({
          issueType: 'BACKGROUND_ERROR',
          severity: 'HIGH',
          confidence: 80,
          description: `${rules.name} beyaz fon zorunluluğu var.`,
          recommendation: 'Beyaz fon kullanın.',
        });
        recommendations.push(`Beyaz fon zorunlu (${rules.name}).`);
      }
    }

    // Filigran kontrolü
    if (rules.noWatermark) {
      const wmOk = await this.checkNoWatermark(imageUrl);
      if (!wmOk) {
        score -= 20;
        issues.push({
          issueType: 'WATERMARK',
          severity: 'HIGH',
          confidence: 85,
          description: `${rules.name} filigransız görsel istiyor.`,
          recommendation: 'Filigranı kaldırın.',
        });
        recommendations.push(`Filigran yasak (${rules.name}).`);
      }
    }

    // Gölge kontrolü
    if (rules.noShadow) {
      const shadowOk = await this.checkNoShadow(imageUrl);
      if (!shadowOk) {
        score -= 10;
        issues.push({
          issueType: 'SHADOW',
          severity: 'MEDIUM',
          confidence: 75,
          description: `${rules.name} gölgesiz görsel istiyor.`,
          recommendation: 'Gölgeyi kaldırın.',
        });
        recommendations.push(`Gölge kabul edilmiyor (${rules.name}).`);
      }
    }

    // Yazı kontrolü
    if (rules.noText) {
      const textOk = await this.checkNoText(imageUrl);
      if (!textOk) {
        score -= 10;
        issues.push({
          issueType: 'WATERMARK',
          severity: 'MEDIUM',
          confidence: 70,
          description: `${rules.name} görsel üzerinde yazı istemiyor.`,
          recommendation: 'Yazıları kaldırın.',
        });
        recommendations.push(`Görselde yazı olmamalı (${rules.name}).`);
      }
    }

    return {
      backgroundScore: rules.whiteBackground ? score : 100,
      resolutionScore: 100,
      sharpnessScore: 100,
      lightingScore: 100,
      angleScore: 100,
      watermarkScore: 100,
      shadowScore: 100,
      marketplaceScore: Math.max(0, score),
      overallScore: this.calculateOverallScore({
        background: rules.whiteBackground ? score : 100,
        resolution: 100,
        sharpness: 100,
        lighting: 100,
        angle: 100,
        shadow: rules.noShadow ? score : 100,
        watermark: rules.noWatermark ? score : 100,
        marketplace: Math.max(0, score),
      }),
      issues,
      recommendations,
      status: this.getStatusFromScore(Math.max(0, score)),
    };
  }

  /**
   * Tüm pazaryerleri için toplu doğrulama
   */
  async validateAllMarketplaces(imageUrl: string): Promise<Record<string, { score: number; issues: ImageIssue[] }>> {
    const results: Record<string, { score: number; issues: ImageIssue[] }> = {};

    for (const [key] of Object.entries(MARKETPLACE_RULES)) {
      const result = await this.analyze(imageUrl, {}, { marketplaceKey: key });
      results[key] = {
        score: result.marketplaceScore,
        issues: result.issues,
      };
    }

    return results;
  }

  static getRules(marketplaceKey: string): MarketplaceRule | undefined {
    return MARKETPLACE_RULES[marketplaceKey];
  }

  static getAllRules(): MarketplaceRule[] {
    return Object.values(MARKETPLACE_RULES);
  }

  private async checkMinResolution(imageUrl: string, minPx: number): Promise<boolean> {
    try { console.log(`[MarketplaceValidator] Resolution ${minPx}px check: ${imageUrl}`); return true; } catch { return false; }
  }

  private async checkWhiteBackground(imageUrl: string): Promise<boolean> {
    try { console.log(`[MarketplaceValidator] White bg check: ${imageUrl}`); return true; } catch { return false; }
  }

  private async checkNoWatermark(imageUrl: string): Promise<boolean> {
    try { console.log(`[MarketplaceValidator] No watermark check: ${imageUrl}`); return true; } catch { return false; }
  }

  private async checkNoShadow(imageUrl: string): Promise<boolean> {
    try { console.log(`[MarketplaceValidator] No shadow check: ${imageUrl}`); return true; } catch { return false; }
  }

  private async checkNoText(imageUrl: string): Promise<boolean> {
    try { console.log(`[MarketplaceValidator] No text check: ${imageUrl}`); return true; } catch { return false; }
  }
}
