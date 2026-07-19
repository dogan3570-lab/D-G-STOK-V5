// ==================== COPILOT PLANNER V1 ====================
// Kullanıcı isteğine göre işlem planı oluşturur
// Yeni iş mantığı yok, mevcut servisleri organize eder
// ============================================================

import type { CopilotTaskInfo, ModuleName } from './types.ts';
import { CopilotIntentMatcher } from './CopilotIntentMatcher.ts';
import { CopilotActionRouter } from './CopilotActionRouter.ts';

export class CopilotPlanner {
  private intentMatcher = new CopilotIntentMatcher();
  private actionRouter = new CopilotActionRouter();

  /**
   * Kullanıcı sorusunu planla
   */
  async plan(question: string): Promise<{
    intent: any;
    answer: string;
    data?: any;
    tasks: CopilotTaskInfo[];
    requiresApproval: boolean;
  }> {
    const intent = this.intentMatcher.match(question);
    const result = await this.actionRouter.route(intent);

    return {
      intent,
      answer: result.answer,
      data: result.data,
      tasks: result.tasks,
      requiresApproval: result.requiresApproval,
    };
  }
}
