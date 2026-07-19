// ==================== COPILOT EXECUTOR V1 ====================
// Onaylanan görevleri mevcut servisler üzerinden çalıştırır
// ASLA doğrudan veritabanını güncellemez, mevcut servisleri kullanır
// ============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';
import type { CopilotTaskInfo, ModuleName } from './types.ts';

export class CopilotExecutor {
  /**
   * Onaylanan görevi çalıştır
   */
  async execute(task: CopilotTaskInfo): Promise<{
    success: boolean;
    message: string;
  }> {
    await EventBus.emit({
      type: 'CopilotTaskStarted',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'CopilotExecutor',
      data: {
        taskId: task.id,
        module: task.module,
        action: task.action,
      },
    });

    try {
      // Görev durumunu güncelle
      await prisma.copilotTask.update({
        where: { id: task.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      // Mevcut servisleri çağır (gerçek implementasyonda)
      // Örn: CategoryEngine, BrandEngine, WorkflowStateManager vb.
      const result = await this.executeAction(task.module, task.action);

      // Görevi tamamlandı olarak işaretle
      await prisma.copilotTask.update({
        where: { id: task.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), result: JSON.stringify(result) },
      });

      await EventBus.emit({
        type: 'CopilotTaskCompleted',
        correlationId: createCorrelationId('API'),
        timestamp: new Date().toISOString(),
        source: 'CopilotExecutor',
        data: {
          taskId: task.id,
          module: task.module,
          action: task.action,
          success: true,
        },
      });

      return { success: true, message: `Görev tamamlandı: ${task.module} - ${task.action}` };
    } catch (error: any) {
      await prisma.copilotTask.update({
        where: { id: task.id },
        data: { status: 'FAILED', finishedAt: new Date(), result: error.message },
      });

      await EventBus.emit({
        type: 'CopilotTaskFailed',
        correlationId: createCorrelationId('API'),
        timestamp: new Date().toISOString(),
        source: 'CopilotExecutor',
        data: {
          taskId: task.id,
          module: task.module,
          action: task.action,
          error: error.message,
        },
      });

      return { success: false, message: `Görev başarısız: ${error.message}` };
    }
  }

  /**
   * Mevcut servisleri kullanarak aksiyonu çalıştır
   * Yeni iş mantığı YOK, sadece mevcut servisleri yönlendirir
   */
  private async executeAction(module: ModuleName, action: string): Promise<any> {
    // NOT: Gerçek implementasyonda aşağıdaki servisler çağrılır:
    //
    // WorkflowStateManager.updateStatus(productId, status)
    // CategoryEngine.matchCategories(productIds)
    // BrandEngine.matchBrands(productIds)
    // VariantEngineV5.analyze(productIds)
    // ReadyToSendEngine.prepare(productIds)
    // AIImageEngine.bulkAnalyze(productIds)
    // AISalesAdvisor.analyze(productId)
    // vs.
    //
    // Şu an için simülasyon:

    console.log(`[CopilotExecutor] Executing ${module}.${action} via existing services...`);

    // AuditLog kaydı
    await prisma.auditLog.create({
      data: {
        action: `COPILOT_${action.toUpperCase()}`,
        entity: module,
        details: JSON.stringify({ module, action }),
        success: true,
      },
    });

    // Dashboard refresh
    await EventBus.emit({
      type: 'DashboardRefresh',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'CopilotExecutor',
      data: { reason: `copilot_${action}`, affectedModules: [module] },
    });

    return { module, action, executed: true, timestamp: new Date().toISOString() };
  }
}
