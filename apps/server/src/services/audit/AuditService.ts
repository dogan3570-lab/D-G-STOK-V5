import { prisma } from '../../db/prisma.ts';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string;
  actorUserId?: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  ipAddress?: string;
  sessionId?: string;
  success?: boolean;
}

export class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          actorUserId: entry.actorUserId,
          meta: JSON.stringify({
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            details: entry.details,
            ipAddress: entry.ipAddress,
            sessionId: entry.sessionId,
          }),
          details: entry.details,
          success: entry.success ?? true,
        },
      });
    } catch (error) {
      console.error('[AuditService] Log hatasi:', error);
    }
  }

  async getHistory(entity: string, entityId: string, limit = 50): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actorUser: { select: { email: true, name: true } } },
    });
  }
}
