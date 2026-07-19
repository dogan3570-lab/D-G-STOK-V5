// ==================== IMAGE QUALITY ENGINE V1 ====================
// Tüm görsel kalite kontrol motorlarını yöneten merkezi sınıf
// ================================================================

import { ImageAnalyzer, type AnalysisResult, type AnalysisConfig, type ImageIssue, type ProductCategory } from './ImageAnalyzer.ts';
import { BackgroundDetector } from './BackgroundDetector.ts';
import { WatermarkDetector } from './WatermarkDetector.ts';
import { ShadowDetector } from './ShadowDetector.ts';
import { AngleDetector } from './AngleDetector.ts';
import { ResolutionAnalyzer } from './ResolutionAnalyzer.ts';
import { MarketplaceImageValidator } from './MarketplaceImageValidator.ts';
import { ImageRecommendationEngine, type Recommendation } from './ImageRecommendationEngine.ts';

export class ImageQualityEngine extends ImageAnalyzer {
  private backgroundDetector = new BackgroundDetector();
  private watermarkDetector = new WatermarkDetector();
  private shadowDetector = new ShadowDetector();
  private angleDetector = new AngleDetector();
  private resolutionAnalyzer = new ResolutionAnalyzer();
  private marketplaceValidator = new MarketplaceImageValidator();
  private recommendationEngine = new ImageRecommendationEngine();

  /**
   * Tek bir görsel için tam analiz yapar
   */
  async analyze(imageUrl: string, metadata?: Partial<{ url: string; width: number; height: number; format: string; fileSize: number }>, config?: AnalysisConfig): Promise<AnalysisResult> {
    const [background, watermark, shadow, angle, resolution, marketplace] = await Promise.all([
      this.backgroundDetector.analyze(imageUrl, metadata, config),
      this.watermarkDetector.analyze(imageUrl, metadata, config),
      this.shadowDetector.analyze(imageUrl, metadata, config),
      this.angleDetector.analyze(imageUrl, metadata, config),
      this.resolutionAnalyzer.analyze(imageUrl, metadata, config),
      this.marketplaceValidator.analyze(imageUrl, metadata, config),
    ]);

    const allIssues: ImageIssue[] = [
      ...background.issues,
      ...watermark.issues,
      ...shadow.issues,
      ...angle.issues,
      ...resolution.issues,
      ...marketplace.issues,
    ];

    // Kategoriye özel kontroller
    const categoryIssues = await this.runCategorySpecificChecks(imageUrl, config?.category);
    allIssues.push(...categoryIssues);

    // Benzersiz issue'lar
    const uniqueIssues = this.deduplicateIssues(allIssues);

    const overallScore = this.calculateOverallScore({
      background: background.backgroundScore,
      resolution: resolution.resolutionScore,
      sharpness: resolution.sharpnessScore,
      lighting: resolution.lightingScore,
      angle: angle.angleScore,
      shadow: shadow.shadowScore,
      watermark: watermark.watermarkScore,
      marketplace: marketplace.marketplaceScore,
    });

    const analysisResult: AnalysisResult = {
      backgroundScore: background.backgroundScore,
      resolutionScore: resolution.resolutionScore,
      sharpnessScore: resolution.sharpnessScore,
      lightingScore: resolution.lightingScore,
      angleScore: angle.angleScore,
      shadowScore: shadow.shadowScore,
      watermarkScore: watermark.watermarkScore,
      marketplaceScore: marketplace.marketplaceScore,
      overallScore,
      issues: uniqueIssues,
      recommendations: this.recommendationEngine.generateRecommendations({
        backgroundScore: background.backgroundScore,
        resolutionScore: resolution.resolutionScore,
        sharpnessScore: resolution.sharpnessScore,
        lightingScore: resolution.lightingScore,
        angleScore: angle.angleScore,
        shadowScore: shadow.shadowScore,
        watermarkScore: watermark.watermarkScore,
        marketplaceScore: marketplace.marketplaceScore,
        overallScore,
        issues: uniqueIssues,
        recommendations: [],
        status: this.getStatusFromScore(overallScore),
      } as AnalysisResult).map((r: Recommendation) => r.message),
      status: this.getStatusFromScore(overallScore),
    };

    return analysisResult;
  }

  /**
   * Kategoriye özel kontroller
   */
  private async runCategorySpecificChecks(imageUrl: string, category?: ProductCategory): Promise<ImageIssue[]> {
    const issues: ImageIssue[] = [];

    if (category === 'AYAKKABI') {
      // Ayakkabı: ayak içinde değil kontrolü
      const footInShoe = await this.checkFootInShoe(imageUrl);
      if (footInShoe) {
        issues.push({
          issueType: 'ANGLE',
          severity: 'HIGH',
          confidence: 85,
          description: 'Ayakkabı ayağın içinde gösteriliyor. Ayakkabılar boş olmalıdır.',
          recommendation: 'Ayakkabıyı ayaksız gösterin.',
        });
      }
    }

    if (category === 'GIYIM') {
      // Giyim: kat izi, askı, manken kontrolü
      const [hasCreaseMarks, hasHanger, hasMannequin] = await Promise.all([
        this.checkCreaseMarks(imageUrl),
        this.checkHanger(imageUrl),
        this.checkMannequin(imageUrl),
      ]);

      if (hasCreaseMarks) {
        issues.push({
          issueType: 'BACKGROUND_ERROR',
          severity: 'MEDIUM',
          confidence: 70,
          description: 'Üründe kat izi (kırışıklık) tespit edildi.',
          recommendation: 'Ürünü ütüleyin veya kırışıklıkları düzenleyin.',
        });
      }
      if (hasHanger) {
        issues.push({
          issueType: 'BACKGROUND_ERROR',
          severity: 'LOW',
          confidence: 75,
          description: 'Askı görünüyor. Ürün askısız gösterilmelidir.',
          recommendation: 'Askıyı görselden kaldırın.',
        });
      }
      if (hasMannequin) {
        issues.push({
          issueType: 'BACKGROUND_ERROR',
          severity: 'MEDIUM',
          confidence: 80,
          description: 'Manken üzerinde ürün gösterimi. Bazı pazaryerleri manken istemez.',
          recommendation: 'Ürünü mankensiz gösterin.',
        });
      }
    }

    if (category === 'EV') {
      // Ev ürünleri: yansıma, parlama, bulanıklık
      const [hasReflection, hasGlare, isBlurry] = await Promise.all([
        this.checkReflection(imageUrl),
        this.checkGlare(imageUrl),
        this.checkBlurry(imageUrl),
      ]);

      if (hasReflection) {
        issues.push({
          issueType: 'SHADOW',
          severity: 'MEDIUM',
          confidence: 75,
          description: 'Ürün üzerinde yansıma tespit edildi.',
          recommendation: 'Yansımayı önlemek için ışık açısını ayarlayın.',
        });
      }
      if (hasGlare) {
        issues.push({
          issueType: 'SHADOW',
          severity: 'MEDIUM',
          confidence: 70,
          description: 'Parlama tespit edildi.',
          recommendation: 'Difüzör kullanarak parlamayı azaltın.',
        });
      }
      if (isBlurry) {
        issues.push({
          issueType: 'LOW_RESOLUTION',
          severity: 'HIGH',
          confidence: 80,
          description: 'Görsel bulanık. Net bir görsel kullanın.',
          recommendation: 'Bulanıklığı giderin veya yeniden çekim yapın.',
        });
      }
    }

    return issues;
  }

  /**
   * İnsan eli, ayak, gereksiz obje, çoklu ürün tespiti
   */
  async detectCompositionIssues(imageUrl: string): Promise<ImageIssue[]> {
    const issues: ImageIssue[] = [];

    const [hasHumanHand, hasHumanFoot, hasExtraObject, hasMultipleProducts] = await Promise.all([
      this.checkHumanHand(imageUrl),
      this.checkHumanFoot(imageUrl),
      this.checkExtraObject(imageUrl),
      this.checkMultipleProducts(imageUrl),
    ]);

    if (hasHumanHand) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'MEDIUM',
        confidence: 80,
        description: 'Görselde insan eli tespit edildi.',
        recommendation: 'Ürünü elsiz gösterin.',
      });
    }

    if (hasHumanFoot && hasHumanFoot !== undefined) {
      // Ayakkabı için özel durum
    }

    if (hasExtraObject) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'LOW',
        confidence: 70,
        description: 'Görselde gereksiz objeler tespit edildi.',
        recommendation: 'Gereksiz objeleri kaldırın.',
      });
    }

    if (hasMultipleProducts) {
      issues.push({
        issueType: 'ANGLE',
        severity: 'MEDIUM',
        confidence: 75,
        description: 'Görselde birden fazla ürün var. Tek ürün gösterilmelidir.',
        recommendation: 'Her görselde tek ürün gösterin.',
      });
    }

    return issues;
  }

  async getRecommendations(result: AnalysisResult): Promise<Recommendation[]> {
    return this.recommendationEngine.generateRecommendations(result);
  }

  /**
   * Tekrarlayan issue'ları temizler
   */
  private deduplicateIssues(issues: ImageIssue[]): ImageIssue[] {
    const seen = new Set<string>();
    return issues.filter(issue => {
      const key = `${issue.issueType}:${issue.severity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ==================== AI SERVIS ÇAĞRILARI ====================

  private async checkFootInShoe(_imageUrl: string): Promise<boolean> { return false; }
  private async checkCreaseMarks(_imageUrl: string): Promise<boolean> { return false; }
  private async checkHanger(_imageUrl: string): Promise<boolean> { return false; }
  private async checkMannequin(_imageUrl: string): Promise<boolean> { return false; }
  private async checkReflection(_imageUrl: string): Promise<boolean> { return false; }
  private async checkGlare(_imageUrl: string): Promise<boolean> { return false; }
  private async checkBlurry(_imageUrl: string): Promise<boolean> { return false; }
  private async checkHumanHand(_imageUrl: string): Promise<boolean> { return false; }
  private async checkHumanFoot(_imageUrl: string): Promise<boolean> { return false; }
  private async checkExtraObject(_imageUrl: string): Promise<boolean> { return false; }
  private async checkMultipleProducts(_imageUrl: string): Promise<boolean> { return false; }
}
