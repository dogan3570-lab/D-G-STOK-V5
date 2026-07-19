// ==================== DG STOK AI IMAGE ANALYZER V1 ====================
// Temel görsel analiz arayüzü ve tipleri
// ======================================================================

export type ProductCategory = 'AYAKKABI' | 'GIYIM' | 'EV' | 'GENEL';

export interface AnalysisResult {
  backgroundScore: number;
  resolutionScore: number;
  sharpnessScore: number;
  lightingScore: number;
  angleScore: number;
  watermarkScore: number;
  shadowScore: number;
  marketplaceScore: number;
  overallScore: number;
  issues: ImageIssue[];
  recommendations: string[];
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_REVIEW' | 'POOR' | 'REJECT';
}

export interface ImageIssue {
  issueType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  description: string;
  recommendation: string;
}

export interface AnalysisConfig {
  category?: ProductCategory;
  marketplaceKey?: string;
  minResolution?: number;
  checkWatermark?: boolean;
  checkShadow?: boolean;
  checkAngle?: boolean;
  checkBackground?: boolean;
  checkComposition?: boolean;
}

export interface ImageMetadata {
  url: string;
  width?: number;
  height?: number;
  format?: string;
  fileSize?: number;
}

/**
 * ImageAnalyzer - Tüm görsel analiz motorlarının temel sınıfı
 */
export abstract class ImageAnalyzer {
  abstract analyze(imageUrl: string, metadata?: Partial<ImageMetadata>, config?: AnalysisConfig): Promise<AnalysisResult>;

  protected calculateOverallScore(scores: {
    background: number;
    resolution: number;
    sharpness: number;
    lighting: number;
    angle: number;
    shadow: number;
    watermark: number;
    marketplace: number;
  }): number {
    // Ağırlıklı skorlama
    const weights = {
      background: 20,
      resolution: 10,
      sharpness: 10,
      lighting: 10,
      angle: 15,
      shadow: 10,
      watermark: 15,
      marketplace: 10,
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const weightedScore =
      (scores.background * weights.background) +
      (scores.resolution * weights.resolution) +
      (scores.sharpness * weights.sharpness) +
      (scores.lighting * weights.lighting) +
      (scores.angle * weights.angle) +
      (scores.shadow * weights.shadow) +
      (scores.watermark * weights.watermark) +
      (scores.marketplace * weights.marketplace);

    return Math.round(weightedScore / totalWeight);
  }

  protected getStatusFromScore(score: number): AnalysisResult['status'] {
    if (score >= 95) return 'EXCELLENT';
    if (score >= 85) return 'GOOD';
    if (score >= 70) return 'NEEDS_REVIEW';
    if (score >= 50) return 'POOR';
    return 'REJECT';
  }
}
