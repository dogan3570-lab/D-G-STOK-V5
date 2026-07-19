// ==================== AI IMAGE ENGINE V1 ====================
// DG STOK V5.0 - Ana AI Görsel Kalite Merkezi Motoru
// ===========================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';
import { ImageQualityEngine } from './ImageQualityEngine.ts';
import { ImageRecommendationEngine, type Recommendation } from './ImageRecommendationEngine.ts';
import { MarketplaceImageValidator } from './MarketplaceImageValidator.ts';
import type { AnalysisResult, AnalysisConfig, ProductCategory, ImageIssue } from './ImageAnalyzer.ts';

type AnalysisStatus = 'PENDING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

interface BulkAnalysisResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    productId: string;
    imageUrl: string;
    score: number;
    status: string;
    issues: ImageIssue[];
  }>;
}

export class AIImageEngine {
  private qualityEngine = new ImageQualityEngine();
  private recommendationEngine = new ImageRecommendationEngine();
  private marketplaceValidator = new MarketplaceImageValidator();

  /**
   * Tek bir ürün görselini analiz eder
   */
  async analyzeProductImage(
    productId: string,
    imageUrl: string,
    config?: {
      category?: ProductCategory;
      marketplaceKey?: string;
    }
  ): Promise<{
    analysis: AnalysisResult;
    analysisId: string;
  }> {
    // Analiz kaydı oluştur
    const analysis = await prisma.aIImageAnalysis.create({
      data: {
        productId,
        imageUrl,
        overallScore: 0,
        backgroundScore: 0,
        resolutionScore: 0,
        sharpnessScore: 0,
        lightingScore: 0,
        angleScore: 0,
        watermarkScore: 0,
        shadowScore: 0,
        marketplaceScore: 0,
        status: 'ANALYZING',
      },
    });

    try {
      // AI analizi yap
      const result = await this.qualityEngine.analyze(imageUrl, { url: imageUrl }, {
        category: config?.category,
        marketplaceKey: config?.marketplaceKey,
      });

      // Issue'ları kaydet
      for (const issue of result.issues) {
        await prisma.aIImageIssue.create({
          data: {
            analysisId: analysis.id,
            issueType: issue.issueType,
            severity: issue.severity,
            confidence: issue.confidence,
            description: issue.description,
            recommendation: issue.recommendation,
          },
        });
      }

      // Analiz kaydını güncelle
      const updated = await prisma.aIImageAnalysis.update({
        where: { id: analysis.id },
        data: {
          overallScore: result.overallScore,
          backgroundScore: result.backgroundScore,
          resolutionScore: result.resolutionScore,
          sharpnessScore: result.sharpnessScore,
          lightingScore: result.lightingScore,
          angleScore: result.angleScore,
          watermarkScore: result.watermarkScore,
          shadowScore: result.shadowScore,
          marketplaceScore: result.marketplaceScore,
          status: 'COMPLETED',
        },
        include: {
          issues: true,
        },
      });

      // EventBus: Görsel analiz tamamlandı
      await EventBus.emit({
        type: 'ImageAnalyzed',
        correlationId: createCorrelationId('API'),
        timestamp: new Date().toISOString(),
        source: 'AIImageEngine',
        data: {
          productId,
          imageUrl,
          overallScore: result.overallScore,
          status: result.status,
          issueCount: result.issues.length,
          analysisId: analysis.id,
        },
      });

      // Kritik sorun varsa event yayınla
      const criticalIssues = result.issues.filter(i => i.severity === 'CRITICAL');
      if (criticalIssues.length > 0) {
        await EventBus.emit({
          type: 'ImageIssueDetected',
          correlationId: createCorrelationId('API'),
          timestamp: new Date().toISOString(),
          source: 'AIImageEngine',
          data: {
            productId,
            imageUrl,
            analysisId: analysis.id,
            issues: criticalIssues,
            overallScore: result.overallScore,
          },
        });
      }

      // AI Command Center'a issue kaydet
      await this.syncToAICommandCenter(productId, result);

      // WorkflowState güncelle
      await this.updateWorkflowState(productId, result);

      return { analysis: result, analysisId: analysis.id };
    } catch (error: any) {
      // Hata durumunda analizi güncelle
      await prisma.aIImageAnalysis.update({
        where: { id: analysis.id },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  /**
   * Toplu görsel analizi
   */
  async bulkAnalyze(
    productIds: string[],
    config?: {
      category?: ProductCategory;
      marketplaceKey?: string;
    }
  ): Promise<BulkAnalysisResult> {
    const result: BulkAnalysisResult = {
      totalProcessed: productIds.length,
      successful: 0,
      failed: 0,
      results: [],
    };

    // EventBus: Toplu analiz başladı
    await EventBus.emit({
      type: 'ImageAnalyzed',
      correlationId: createCorrelationId('BATCH'),
      timestamp: new Date().toISOString(),
      source: 'AIImageEngine',
      data: {
        productIds,
        totalCount: productIds.length,
        batchAnalysis: true,
      },
    });

    const BATCH_SIZE = 10;
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batch = productIds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (productId) => {
        try {
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, images: true },
          });

          if (!product?.images) {
            result.failed++;
            return;
          }

          // İlk görseli analiz et
          const images = JSON.parse(product.images);
          const imageUrl = Array.isArray(images) ? images[0] : images;

          if (!imageUrl) {
            result.failed++;
            return;
          }

          const analysis = await this.analyzeProductImage(productId, String(imageUrl), config);
          result.successful++;
          result.results.push({
            productId,
            imageUrl: String(imageUrl),
            score: analysis.analysis.overallScore,
            status: analysis.analysis.status,
            issues: analysis.analysis.issues,
          });
        } catch {
          result.failed++;
        }
      });

      await Promise.allSettled(promises);
    }

    // EventBus: Toplu analiz tamamlandı
    await EventBus.emit({
      type: 'ImageAnalyzed',
      correlationId: createCorrelationId('BATCH'),
      timestamp: new Date().toISOString(),
      source: 'AIImageEngine',
      data: {
        ...result,
        batchCompleted: true,
      },
    });

    return result;
  }

  /**
   * Belirli sayıda ürünü analiz et (100, 500, 1000, 5000)
   */
  async analyzeByCount(count: number, config?: AnalysisConfig): Promise<BulkAnalysisResult> {
    const validCounts = [100, 500, 1000, 5000];
    if (!validCounts.includes(count)) {
      throw new Error(`Geçersiz sayı: ${count}. Geçerli değerler: ${validCounts.join(', ')}`);
    }

    const products = await prisma.product.findMany({
      where: {
        images: { not: null },
      },
      take: count,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    return this.bulkAnalyze(
      products.map(p => p.id),
      config,
    );
  }

  /**
   * AI Command Center'a issue kaydet
   */
  private async syncToAICommandCenter(productId: string, result: AnalysisResult): Promise<void> {
    const issueTypeMap: Record<string, string> = {
      'BACKGROUND_ERROR': 'IMAGE_LOW',
      'LOW_RESOLUTION': 'IMAGE_LOW',
      'WATERMARK': 'IMAGE_LOW',
      'SHADOW': 'IMAGE_LOW',
      'ANGLE': 'IMAGE_LOW',
    };

    for (const issue of result.issues) {
      const mappedType = issueTypeMap[issue.issueType] || 'IMAGE_LOW';

      await prisma.aIIssue.create({
        data: {
          productId,
          module: 'image',
          type: mappedType,
          severity: issue.severity,
          priority: issue.severity === 'CRITICAL' ? 1 : issue.severity === 'HIGH' ? 2 : 3,
          confidence: issue.confidence,
          title: issue.issueType,
          description: issue.description,
          recommendedAction: issue.recommendation,
        },
      });
    }
  }

  /**
   * WorkflowState güncelle
   */
  private async updateWorkflowState(productId: string, result: AnalysisResult): Promise<void> {
    const ws = await prisma.workflowState.findUnique({ where: { productId } });
    if (!ws) return;

    const stepImage = result.overallScore >= 85 ? 'OK'
      : result.overallScore >= 70 ? 'AUTO_FIXED'
      : 'MISSING';

    await prisma.workflowState.update({
      where: { productId },
      data: {
        stepImage,
        readiness: Math.min(100, ws.readiness + (stepImage === 'OK' ? 10 : stepImage === 'AUTO_FIXED' ? 5 : -10)),
        status: stepImage === 'MISSING' ? 'BLOCKED' : ws.status,
      },
    });

    // Timeline'a ekle
    await prisma.workflowTimeline.create({
      data: {
        productId,
        event: 'AI_IMAGE_ANALYSIS',
        details: JSON.stringify({
          overallScore: result.overallScore,
          status: result.status,
          issueCount: result.issues.length,
          stepImage,
        }),
      },
    });
  }

  /**
   * Dashboard istatistikleri
   */
  async getDashboardStats(): Promise<{
    totalAnalyses: number;
    excellent: number;
    good: number;
    needsReview: number;
    poor: number;
    reject: number;
    watermarkIssues: number;
    backgroundIssues: number;
    resolutionIssues: number;
    angleIssues: number;
    byMarketplace: Record<string, number>;
  }> {
    const [total, byStatus, watermarkCount, backgroundCount, resolutionCount, angleCount] = await Promise.all([
      prisma.aIImageAnalysis.count(),
      prisma.aIImageAnalysis.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.aIImageIssue.count({ where: { issueType: 'WATERMARK' } }),
      prisma.aIImageIssue.count({ where: { issueType: 'BACKGROUND_ERROR' } }),
      prisma.aIImageIssue.count({ where: { issueType: 'LOW_RESOLUTION' } }),
      prisma.aIImageIssue.count({ where: { issueType: 'ANGLE' } }),
    ]);

    // Skor bazlı gruplama
    const [excellent, good, needsReview, poor, reject] = await Promise.all([
      prisma.aIImageAnalysis.count({ where: { overallScore: { gte: 95 }, status: 'COMPLETED' } }),
      prisma.aIImageAnalysis.count({ where: { overallScore: { gte: 85, lt: 95 }, status: 'COMPLETED' } }),
      prisma.aIImageAnalysis.count({ where: { overallScore: { gte: 70, lt: 85 }, status: 'COMPLETED' } }),
      prisma.aIImageAnalysis.count({ where: { overallScore: { gte: 50, lt: 70 }, status: 'COMPLETED' } }),
      prisma.aIImageAnalysis.count({ where: { overallScore: { lt: 50 }, status: 'COMPLETED' } }),
    ]);

    return {
      totalAnalyses: total,
      excellent,
      good,
      needsReview,
      poor,
      reject,
      watermarkIssues: watermarkCount,
      backgroundIssues: backgroundCount,
      resolutionIssues: resolutionCount,
      angleIssues: angleCount,
      byMarketplace: {},
    };
  }

  /**
   * Rapor getir
   */
  async getProductReport(productId: string) {
    const analysis = await prisma.aIImageAnalysis.findFirst({
      where: { productId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: {
        issues: true,
      },
    });

    if (!analysis) return null;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, sku: true, images: true },
    });

    return {
      product,
      analysis,
      recommendations: analysis.issues.map(i => i.recommendation),
    };
  }

  /**
   * Issue'ları getir
   */
  async getIssues(filters?: {
    severity?: string;
    issueType?: string;
    resolved?: boolean;
    marketplace?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.issueType) where.issueType = filters.issueType;
    if (filters?.resolved !== undefined) where.resolved = filters.resolved;

    return prisma.aIImageIssue.findMany({
      where,
      include: {
        analysis: {
          select: {
            productId: true,
            imageUrl: true,
            overallScore: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Issue onayla/reddet
   */
  async approveIssue(issueId: string, approved: boolean): Promise<void> {
    const issue = await prisma.aIImageIssue.update({
      where: { id: issueId },
      data: { approved, resolved: approved },
    });

    const eventData = {
      issueId,
      issueType: issue.issueType,
      severity: issue.severity,
      approved,
    };

    await EventBus.emit({
      type: approved ? 'ImageApproved' : 'ImageRejected',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'AIImageEngine',
      data: eventData,
    });
  }

  /**
   * Yeniden analiz
   */
  async reanalyze(productId: string, imageUrl?: string): Promise<AnalysisResult> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, images: true },
    });

    if (!product) throw new Error('Ürün bulunamadı');

    const url = imageUrl || (() => {
      if (!product.images) return null;
      try {
        const images = JSON.parse(product.images);
        return Array.isArray(images) ? images[0] : images;
      } catch {
        return product.images;
      }
    })();

    if (!url) throw new Error('Görsel bulunamadı');

    const result = await this.analyzeProductImage(productId, String(url));
    return result.analysis;
  }
}
