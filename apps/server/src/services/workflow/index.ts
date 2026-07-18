// ==================== WORKFLOW SINGLETON EXPORT ====================
// Tüm modüller aynı EventBus ve WorkflowEngine instance'ını kullanır.
// ==================================================================

import { EventBus } from '../operation/EventBus.ts';
import { WorkflowEngine } from './WorkflowEngine.ts';

/** Shared EventBus singleton - tüm modüller aynı instance'ı kullanır */
export const eventBus = EventBus.getInstance();

/** Shared WorkflowEngine singleton */
export const workflowEngine = new WorkflowEngine(eventBus);
