// ==================== COPILOT HISTORY V1 ====================
// Konuşma geçmişi ve tamamlanan görevler
// ============================================================

import { prisma } from '../../db/prisma.ts';

export class CopilotHistory {
  /**
   * Konuşma geçmişini getir
   */
  async getConversations(limit = 20): Promise<any[]> {
    return prisma.copilotConversation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Görev geçmişini getir
   */
  async getTasks(limit = 50): Promise<any[]> {
    return prisma.copilotTask.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * En çok kullanılan komutları getir
   */
  async getTopCommands(limit = 10): Promise<Array<{ question: string; count: number }>> {
    const result = await prisma.copilotConversation.groupBy({
      by: ['question'],
      _count: { question: true },
      orderBy: { _count: { question: 'desc' } },
      take: limit,
    });

    return result.map(r => ({ question: r.question, count: r._count.question }));
  }

  /**
   * İstatistikleri getir
   */
  async getStats(): Promise<{
    totalConversations: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    pendingTasks: number;
  }> {
    const [totalConversations, totalTasks, completedTasks, failedTasks, pendingTasks] = await Promise.all([
      prisma.copilotConversation.count(),
      prisma.copilotTask.count(),
      prisma.copilotTask.count({ where: { status: 'COMPLETED' } }),
      prisma.copilotTask.count({ where: { status: 'FAILED' } }),
      prisma.copilotTask.count({ where: { status: { in: ['PENDING', 'APPROVED', 'RUNNING'] } } }),
    ]);

    return { totalConversations, totalTasks, completedTasks, failedTasks, pendingTasks };
  }
}
