// ==================== AI COPILOT TYPES V1 ====================
// DG STOK V5.0 - Doğal Dil ile Sistem Yönetimi
// =============================================================

export type ModuleName =
  | 'workflow' | 'readyToSend' | 'category' | 'brand' | 'variant'
  | 'pricing' | 'orders' | 'marketplace' | 'stockProtection'
  | 'aiCommandCenter' | 'aiImage' | 'aiSales' | 'dashboard';

export type IntentType =
  | 'ANALYZE' | 'REPORT' | 'SUGGEST' | 'EXECUTE' | 'STATUS' | 'HELP';

export type TaskStatus = 'PENDING' | 'APPROVED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REJECTED';

export interface CopilotRequest {
  userId?: string;
  question: string;
}

export interface CopilotResponse {
  conversationId: string;
  answer: string;
  suggestions: string[];
  requiresApproval: boolean;
  pendingTasks: CopilotTaskInfo[];
  data?: any;
}

export interface CopilotTaskInfo {
  id: string;
  conversationId: string;
  module: ModuleName;
  action: string;
  description: string;
  status: TaskStatus;
  requiresApproval: boolean;
  createdAt?: string;
}

export interface IntentMatch {
  intent: IntentType;
  module: ModuleName;
  confidence: number;
  action: string;
  params: Record<string, any>;
  originalQuestion: string;
}

export interface ContextData {
  workflowState?: any;
  readyToSend?: any;
  aiCommandCenter?: any;
  aiImage?: any;
  aiSales?: any;
  dashboard?: any;
  orders?: any;
  marketplace?: any;
  category?: any;
  brand?: any;
  variant?: any;
  stockProtection?: any;
}

export interface ActionRoute {
  module: ModuleName;
  action: string;
  serviceMethod: string;
  requiresApproval: boolean;
  description: string;
}
