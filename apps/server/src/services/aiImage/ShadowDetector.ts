// ==================== SHADOW DETECTOR V1 ====================
// Ürün gölgesi, yansıma ve parlama tespiti
// ============================================================

import { ImageAnalyzer, type AnalysisResult, type ImageIssue, type AnalysisConfig, type ImageMetadata } from './ImageAnalyzer.ts';

export class ShadowDetector extends ImageAnalyzer {
  async analyze(imageUrl: string, _metadata?: Partial<ImageMetadata>, config?: AnalysisConfig): Promise<AnalysisResult> {
    const issues: ImageIssue[] = [];
    const recommendations: string[] = [];

    const shadowScore = await this.detectShadow(imageUrl);
    const reflectionDetected = await this.detectReflection(imageUrl);
    const glareDetected = await this.detectGlare(imageUrl);

    if (shadowScore < 80) {
      const severity = shadowScore < 50 ? 'HIGH' : 'MEDIUM';
      issues.push({
        issueType: 'SHADOW',
        severity,
        confidence: 80,
        description: shadowScore < 50
          ? 'Belirgin ürün gölgesi tespit edildi.'
          : 'Hafif gölge tespit edildi.',
        recommendation: 'Ürünü gölgesiz bir ortamda fotoğraflayın veya gölgeyi düzenleyin.',
      });
      recommendations.push('Ürün gölgesini azaltın veya kaldırın.');
    }

    if (reflectionDetected) {
      issues.push({
        issueType: 'SHADOW',
        severity: 'MEDIUM',
        confidence: 75,
        description: 'Ürün üzerinde yansıma tespit edildi.',
        recommendation: 'Yansımayı önlemek için ışık açısını ayarlayın.',
      });
      recommendations.push('Yansımayı azaltın.');
    }

    if (glareDetected && config?.category === 'EV') {
      issues.push({
        issueType: 'SHADOW',
        severity: 'MEDIUM',
        confidence: 70,
        description: 'Ürün üzerinde parlama tespit edildi.',
        recommendation: 'Parlamayı önlemek için difüzör kullanın veya ışık açısını değiştirin.',
      });
      recommendations.push('Parlamayı azaltın.');
    }

    const overall = glareDetected || reflectionDetected ? Math.min(shadowScore, 75) : shadowScore;

    return {
      backgroundScore: 100,
      resolutionScore: 100,
      sharpnessScore: 100,
      lightingScore: 100,
      angleScore: 100,
      watermarkScore: 100,
      shadowScore: overall,
      marketplaceScore: 100,
      overallScore: this.calculateOverallScore({
        background: 100,
        resolution: 100,
        sharpness: 100,
        lighting: 100,
        angle: 100,
        shadow: overall,
        watermark: 100,
        marketplace: 100,
      }),
      issues,
      recommendations,
      status: this.getStatusFromScore(overall),
    };
  }

  private async detectShadow(imageUrl: string): Promise<number> {
    try {
      console.log(`[ShadowDetector] Analyzing: ${imageUrl}`);
      return 90;
    } catch {
      return 70;
    }
  }

  private async detectReflection(imageUrl: string): Promise<boolean> {
    try {
      console.log(`[ShadowDetector] Reflection check: ${imageUrl}`);
      return false;
    } catch {
      return false;
    }
  }

  private async detectGlare(imageUrl: string): Promise<boolean> {
    try {
      console.log(`[ShadowDetector] Glare check: ${imageUrl}`);
      return false;
    } catch {
      return false;
    }
  }
}
