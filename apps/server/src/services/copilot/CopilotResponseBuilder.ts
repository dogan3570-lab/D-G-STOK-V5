// ==================== COPILOT RESPONSE BUILDER V1 ====================
// Kullanıcıya gösterilecek yanıtı formatlar
// =====================================================================

import type { CopilotResponse, CopilotTaskInfo } from './types.ts';

export class CopilotResponseBuilder {
  /**
   * Yanıt oluştur
   */
  build(params: {
    conversationId: string;
    answer: string;
    suggestions: string[];
    requiresApproval: boolean;
    tasks: CopilotTaskInfo[];
    data?: any;
  }): CopilotResponse {
    const response: CopilotResponse = {
      conversationId: params.conversationId,
      answer: params.answer,
      suggestions: params.suggestions,
      requiresApproval: params.requiresApproval,
      pendingTasks: params.tasks,
      data: params.data,
    };

    // Onay gerekiyorsa ek bilgi ekle
    if (params.requiresApproval && params.tasks.length > 0) {
      response.answer += `\n\n⚠️ **Onay gerekiyor:** Aşağıdaki işlem için onayınızı bekliyorum.`;

      for (const task of params.tasks) {
        response.answer += `\n- ${task.description}`;
      }

      response.answer += `\n\n✅ Onaylamak için: \`onayla\`\n❌ Reddetmek için: \`reddet\``;
    }

    // Öneriler
    if (params.suggestions.length > 0) {
      response.answer += `\n\n💡 **Önerilen sorular:**`;
      const topSuggestions = params.suggestions.slice(0, 3);
      for (const s of topSuggestions) {
        response.answer += `\n- "${s}"`;
      }
    }

    return response;
  }
}
