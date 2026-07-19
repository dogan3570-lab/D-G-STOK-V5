// ==================== AI COPILOT ENGINE V1 ====================
// DG STOK V5.0 - Doğal Dil ile Sistem Yönetimi Ana Motoru
// Yeni iş mantığı YOK, mevcut servisleri kullanır
// =============================================================

import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../eventBus/EventBus.ts';
import { createCorrelationId } from '../eventBus/events.ts';
import { CopilotPlanner } from './CopilotPlanner.ts';
import { CopilotExecutor } from './CopilotExecutor.ts';
import { CopilotResponseBuilder } from './CopilotResponseBuilder.ts';
import { CopilotHistory } from './CopilotHistory.ts';
import { CopilotSuggestions } from './CopilotSuggestions.ts';
import { CopilotIntentMatcher } from './CopilotIntentMatcher.ts';
import { CopilotPermissions } from './CopilotPermissions.ts';
import type { CopilotResponse, CopilotTaskInfo } from './types.ts';

export class CopilotEngine {
  private planner = new CopilotPlanner();
  private executor = new CopilotExecutor();
  private responseBuilder = new CopilotResponseBuilder();
  private history = new CopilotHistory();
  private suggestions = new CopilotSuggestions();
  private intentMatcher = new CopilotIntentMatcher();
  private permissions = new CopilotPermissions();

  /**
   * Kullanıcı sorusunu işle
   */
  async chat(question: string, userId?: string): Promise<CopilotResponse> {
    // EventBus: Copilot isteği
    await EventBus.emit({
      type: 'CopilotRequested',
      correlationId: createCorrelationId('API'),
      timestamp: new Date().toISOString(),
      source: 'CopilotEngine',
      data: { question, userId },
    });

    // Soruyu planla
    const plan = await this.planner.plan(question);

    // Konuşmayı kaydet
    const conversation = await prisma.copilotConversation.create({
      data: {
        userId: userId || 'anonymous',
        question,
        answer: plan.answer,
      },
    });

    // Onay gerekiyorsa task'leri kaydet
    const tasks: CopilotTaskInfo[] = [];
    for (const task of plan.tasks) {
      const saved = await prisma.copilotTask.create({
        data: {
          conversationId: conversation.id,
          module: task.module,
          action: task.action,
          status: task.requiresApproval ? 'PENDING' : 'APPROVED',
        },
      });

      tasks.push({
        ...task,
        id: saved.id,
        conversationId: conversation.id,
      });
    }

    // Yanıt oluştur
    const suggestions = await this.suggestions.getSuggestions();
    const response = this.responseBuilder.build({
      conversationId: conversation.id,
      answer: plan.answer,
      suggestions,
      requiresApproval: plan.requiresApproval,
      tasks,
      data: plan.data,
    });

    return response;
  }

  /**
   * Bir görevi onayla ve çalıştır
   */
  async approveTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const task = await prisma.copilotTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, message: 'Görev bulunamadı.' };

    if (task.status !== 'PENDING') {
      return { success: false, message: `Görev ${task.status} durumunda, onaylanamaz.` };
    }

    await prisma.copilotTask.update({
      where: { id: taskId },
      data: { status: 'APPROVED' },
    });

    // Görevi çalıştır (mevcut servisler üzerinden)
    const result = await this.executor.execute({
      id: taskId,
      conversationId: task.conversationId,
      module: task.module as any,
      action: task.action,
      description: '',
      status: 'APPROVED',
      requiresApproval: false,
    });

    return result;
  }

  /**
   * Bir görevi reddet
   */
  async rejectTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const task = await prisma.copilotTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, message: 'Görev bulunamadı.' };

    await prisma.copilotTask.update({
      where: { id: taskId },
      data: { status: 'REJECTED' },
    });

    return { success: true, message: 'Görev reddedildi.' };
  }

  /**
   * Konuşma geçmişi
   */
  async getHistory(limit = 20) {
    return this.history.getConversations(limit);
  }

  /**
   * Görev geçmişi
   */
  async getTasks(limit = 50) {
    return this.history.getTasks(limit);
  }

  /**
   * Öneriler
   */
  async getSuggestions(limit = 6) {
    return this.suggestions.getSuggestions(limit);
  }

  /**
   * Durum/istatistik
   */
  async getStatus() {
    return this.history.getStats();
  }
}
