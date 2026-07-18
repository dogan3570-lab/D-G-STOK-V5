import { prisma } from '../../db/prisma.ts';
import { EventBus } from '../operation/EventBus.ts';

export type WorkflowStatus =
  | 'IMPORTED' | 'CATEGORY_READY' | 'BRAND_READY' | 'VARIANT_READY'
  | 'TEMPLATE_READY' | 'PREPARED' | 'PREFLIGHT_OK' | 'READY'
  | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'ARCHIVED';

export type StepType = 'CATEGORY' | 'BRAND' | 'VARIANT' | 'TEMPLATE' | 'PREPARATION' | 'PREFLIGHT' | 'QUEUE' | 'SEND';
export type StepStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

const STEP_FIELD_MAP: Record<StepType, string> = {
  CATEGORY: 'stepCategory',
  BRAND: 'stepBrand',
  VARIANT: 'stepVariant',
  TEMPLATE: 'stepTemplate',
  PREPARATION: 'stepPreparation',
  PREFLIGHT: 'stepPreflight',
  QUEUE: 'stepQueue',
  SEND: 'stepSend',
};

const STATUS_MAP: Record<string, WorkflowStatus> = {
  IMPORTED: 'IMPORTED',
  CATEGORY_READY: 'CATEGORY_READY',
  BRAND_READY: 'BRAND_READY',
  VARIANT_READY: 'VARIANT_READY',
  TEMPLATE_READY: 'TEMPLATE_READY',
  PREPARED: 'PREPARED',
  PREFLIGHT_OK: 'PREFLIGHT_OK',
  READY: 'READY',
};

export class WorkflowEngine {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async start(productId: string): Promise<void> {
    await prisma.workflowState.upsert({
      where: { productId },
      update: { status: 'IMPORTED' },
      create: { productId, status: 'IMPORTED' },
    });
    this.eventBus.emit('product.imported', { productId } as any);
  }

  async completeStep(productId: string, step: StepType): Promise<WorkflowStatus | null> {
    const ws = await prisma.workflowState.findUnique({ where: { productId } });
    if (!ws) return null;

    const field = STEP_FIELD_MAP[step];
    const data: any = { [field]: 'COMPLETED' };

    // Statusu guncelle
    const nextStatus = STATUS_MAP[step === 'CATEGORY' ? 'CATEGORY_READY' :
      step === 'BRAND' ? 'BRAND_READY' :
      step === 'VARIANT' ? 'VARIANT_READY' :
      step === 'TEMPLATE' ? 'TEMPLATE_READY' :
      step === 'PREPARATION' ? 'PREPARED' :
      step === 'PREFLIGHT' ? 'PREFLIGHT_OK' :
      step === 'QUEUE' ? 'QUEUED' :
      step === 'SEND' ? 'SENT' : 'READY'];

    if (nextStatus) data.status = nextStatus;

    const updated = await prisma.workflowState.update({
      where: { productId },
      data,
    });

    // Event firlat
    const eventName = `workflow.${step.toLowerCase()}.completed`;
    this.eventBus.emit(eventName, { productId, status: updated.status } as any);

    return updated.status as WorkflowStatus;
  }

  async getStatus(productId: string): Promise<WorkflowStatus | null> {
    const ws = await prisma.workflowState.findUnique({ where: { productId } });
    return ws ? ws.status as WorkflowStatus : null;
  }

  async getStats(): Promise<{ total: number; byStatus: Record<string, number> }> {
    const states = await prisma.workflowState.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const s of states) {
      byStatus[s.status] = s._count.status;
      total += s._count.status;
    }
    return { total, byStatus };
  }
}
