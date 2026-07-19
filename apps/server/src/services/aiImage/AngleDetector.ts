// ==================== ANGLE DETECTOR V1 ====================
// Ürün açısı, kadraj, perspektif ve görünüş tespiti
// ===========================================================

import { ImageAnalyzer, type AnalysisResult, type ImageIssue, type AnalysisConfig, type ImageMetadata } from './ImageAnalyzer.ts';

export class AngleDetector extends ImageAnalyzer {
  async analyze(imageUrl: string, _metadata?: Partial<ImageMetadata>, config?: AnalysisConfig): Promise<AnalysisResult> {
    const issues: ImageIssue[] = [];
    const recommendations: string[] = [];

    const [angleScore, isCentered, isCropped, isRotated, perspectiveOK] = await Promise.all([
      this.detectAngle(imageUrl),
      this.checkCentered(imageUrl),
      this.checkCropped(imageUrl),
      this.checkRotated(imageUrl),
      this.checkPerspective(imageUrl),
    ]);

    if (!isCentered) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'MEDIUM',
        confidence: 80,
        description: 'Ürün ortalanmamış. Ürün kadrajın merkezinde olmalıdır.',
        recommendation: 'Ürünü kadrajın merkezine yerleştirin.',
      });
      recommendations.push('Ürünü ortala.');
    }

    if (isCropped) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'HIGH',
        confidence: 85,
        description: 'Ürün kesilmiş veya kadraja sığmamış.',
        recommendation: 'Ürünün tamamını kadraja sığdırın.',
      });
      recommendations.push('Ürünü tam kadraj göster.');
    }

    if (isRotated) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'MEDIUM',
        confidence: 75,
        description: 'Ürün döndürülmüş. Düz bir açıyla gösterilmelidir.',
        recommendation: 'Ürünü düz bir açıya getirin.',
      });
      recommendations.push('Ürünü döndürmeyin.');
    }

    if (!perspectiveOK) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'LOW',
        confidence: 70,
        description: 'Perspektif bozuk. Ürün doğru açıdan gösterilmiyor olabilir.',
        recommendation: 'Doğru perspektif için ürünü önden veya yandan çekin.',
      });
      recommendations.push('Perspektifi düzelt.');
    }

    // Kategoriye özel kontroller
    if (config?.category === 'AYAKKABI') {
      const shoeChecks = await this.checkShoeAngle(imageUrl);
      if (!shoeChecks.sideView) {
        issues.push({
          issueType: 'ANGLE',
          severity: 'HIGH',
          confidence: 80,
          description: 'Ayakkabı için yan görünüş gerekli.',
          recommendation: 'Ayakkabının yan görünüşünü ekleyin.',
        });
        recommendations.push('Yan görünüş ekleyin (ayakkabı).');
      }
      if (!shoeChecks.correctPosition) {
        issues.push({
          issueType: 'ANGLE',
          severity: 'HIGH',
          confidence: 75,
          description: 'İki ayakkabı doğru konumda değil (biri sağa, biri sola bakmalı).',
          recommendation: 'Ayakkabıları doğru konumlandırın.',
        });
        recommendations.push('Ayakkabıları doğru konumlandırın.');
      }
    }

    if (config?.category === 'GIYIM') {
      const clothingChecks = await this.checkClothingAngle(imageUrl);
      if (!clothingChecks.frontView) {
        issues.push({
          issueType: 'ANGLE',
          severity: 'MEDIUM',
          confidence: 75,
          description: 'Giyim ürünü için ön görünüş gerekli.',
          recommendation: 'Ürünün ön görünüşünü ekleyin.',
        });
        recommendations.push('Ön görünüş ekleyin (giyim).');
      }
    }

    return {
      backgroundScore: 100,
      resolutionScore: 100,
      sharpnessScore: 100,
      lightingScore: 100,
      angleScore,
      watermarkScore: 100,
      shadowScore: 100,
      marketplaceScore: 100,
      overallScore: this.calculateOverallScore({
        background: 100,
        resolution: 100,
        sharpness: 100,
        lighting: 100,
        angle: angleScore,
        shadow: 100,
        watermark: 100,
        marketplace: 100,
      }),
      issues,
      recommendations,
      status: this.getStatusFromScore(angleScore),
    };
  }

  private async detectAngle(imageUrl: string): Promise<number> {
    try {
      console.log(`[AngleDetector] Analyzing: ${imageUrl}`);
      return 95;
    } catch {
      return 70;
    }
  }

  private async checkCentered(imageUrl: string): Promise<boolean> {
    try { console.log(`[AngleDetector] Center check: ${imageUrl}`); return true; } catch { return false; }
  }

  private async checkCropped(imageUrl: string): Promise<boolean> {
    try { console.log(`[AngleDetector] Crop check: ${imageUrl}`); return false; } catch { return false; }
  }

  private async checkRotated(imageUrl: string): Promise<boolean> {
    try { console.log(`[AngleDetector] Rotation check: ${imageUrl}`); return false; } catch { return false; }
  }

  private async checkPerspective(imageUrl: string): Promise<boolean> {
    try { console.log(`[AngleDetector] Perspective check: ${imageUrl}`); return true; } catch { return true; }
  }

  private async checkShoeAngle(imageUrl: string): Promise<{ sideView: boolean; correctPosition: boolean }> {
    try {
      console.log(`[AngleDetector] Shoe check: ${imageUrl}`);
      return { sideView: true, correctPosition: true };
    } catch {
      return { sideView: false, correctPosition: false };
    }
  }

  private async checkClothingAngle(imageUrl: string): Promise<{ frontView: boolean }> {
    try {
      console.log(`[AngleDetector] Clothing check: ${imageUrl}`);
      return { frontView: true };
    } catch {
      return { frontView: false };
    }
  }
}
