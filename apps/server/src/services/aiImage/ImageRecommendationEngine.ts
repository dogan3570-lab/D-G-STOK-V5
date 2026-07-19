// ==================== IMAGE RECOMMENDATION ENGINE V1 ====================
// Analiz sonuçlarına göre iyileştirme önerileri üretir
// ========================================================================

import type { AnalysisResult, ImageIssue } from './ImageAnalyzer.ts';

export interface Recommendation {
  priority: number;
  category: string;
  message: string;
  impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  autoFixable: boolean;
}

export class ImageRecommendationEngine {
  /**
   * Analiz sonucundan öneriler üretir
   */
  generateRecommendations(result: AnalysisResult): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Kritik sorunlar
    if (result.overallScore < 50) {
      recommendations.push({
        priority: 1,
        category: 'GENERAL',
        message: 'Görsel kalitesi çok düşük, yeniden çekim önerilir.',
        impact: 'CRITICAL',
        autoFixable: false,
      });
    }

    // Her issue için öneri
    for (const issue of result.issues) {
      recommendations.push(this.issueToRecommendation(issue));
    }

    // Kategori bazlı özel öneriler
    if (result.backgroundScore < 80) {
      recommendations.push({
        priority: 2,
        category: 'BACKGROUND',
        message: 'Arka planı beyaz fon ile değiştirin veya temizleyin.',
        impact: 'HIGH',
        autoFixable: true,
      });
    }

    if (result.shadowScore < 70) {
      recommendations.push({
        priority: 3,
        category: 'SHADOW',
        message: 'Gölge azaltılırsa kalite artar. Diffüz ışık kullanın.',
        impact: 'MEDIUM',
        autoFixable: true,
      });
    }

    if (result.resolutionScore < 80) {
      recommendations.push({
        priority: 4,
        category: 'RESOLUTION',
        message: 'Yüksek çözünürlüklü görsel kullanın (en az 800x800px).',
        impact: 'HIGH',
        autoFixable: false,
      });
    }

    if (result.watermarkScore < 80) {
      recommendations.push({
        priority: 5,
        category: 'WATERMARK',
        message: 'Filigran, logo, yazı ve etiketleri kaldırın.',
        impact: 'HIGH',
        autoFixable: true,
      });
    }

    if (result.angleScore < 80) {
      recommendations.push({
        priority: 6,
        category: 'ANGLE',
        message: 'Ürünü doğru açıdan ve ortalanmış şekilde gösterin.',
        impact: 'MEDIUM',
        autoFixable: false,
      });
    }

    // Skor düşükse genel öneri
    if (result.overallScore < 70) {
      const worstCategory = this.getWorstCategory(result);
      recommendations.push({
        priority: 7,
        category: 'GENERAL',
        message: `En düşük puan alan alan: ${worstCategory}. Bu alanı iyileştirin.`,
        impact: 'MEDIUM',
        autoFixable: false,
      });
    }

    // Sırala
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Toplu analiz için özet öneriler
   */
  generateBulkRecommendations(results: AnalysisResult[]): {
    totalAnalyzed: number;
    criticalCount: number;
    topIssues: Array<{ issueType: string; count: number }>;
    summary: string;
  } {
    const issueCount = new Map<string, number>();
    let criticalCount = 0;

    for (const result of results) {
      if (result.status === 'REJECT' || result.status === 'POOR') {
        criticalCount++;
      }
      for (const issue of result.issues) {
        issueCount.set(issue.issueType, (issueCount.get(issue.issueType) || 0) + 1);
      }
    }

    const topIssues = Array.from(issueCount.entries())
      .map(([issueType, count]) => ({ issueType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalAnalyzed: results.length,
      criticalCount,
      topIssues,
      summary: `${results.length} görsel analiz edildi. ${criticalCount} kritik sorun tespit edildi. En yaygın sorun: ${topIssues[0]?.issueType || 'Yok'}.`,
    };
  }

  /**
   * En düşük skorlu kategoriyi döndürür
   */
  private getWorstCategory(result: AnalysisResult): string {
    const scores: Array<{ name: string; score: number }> = [
      { name: 'Arka Plan', score: result.backgroundScore },
      { name: 'Çözünürlük', score: result.resolutionScore },
      { name: 'Keskinlik', score: result.sharpnessScore },
      { name: 'Işık', score: result.lightingScore },
      { name: 'Açı', score: result.angleScore },
      { name: 'Gölge', score: result.shadowScore },
      { name: 'Filigran', score: result.watermarkScore },
      { name: 'Pazaryeri', score: result.marketplaceScore },
    ];

    return scores.reduce((min, curr) => curr.score < min.score ? curr : min).name;
  }

  private issueToRecommendation(issue: ImageIssue): Recommendation {
    const priorityMap: Record<string, number> = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
    };

    return {
      priority: priorityMap[issue.severity] || 5,
      category: issue.issueType,
      message: issue.recommendation,
      impact: issue.severity,
      autoFixable: issue.severity !== 'CRITICAL',
    };
  }
}
