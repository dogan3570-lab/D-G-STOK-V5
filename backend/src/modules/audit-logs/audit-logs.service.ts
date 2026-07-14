import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    action: AuditAction;
    entity: string;
    entityId?: string;
    userId?: string;
    userName?: string;
    changes?: Record<string, any>;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const log = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(log);
  }

  async findAll(page = 1, limit = 10, filters?: {
    action?: AuditAction;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (filters?.action) where.action = filters.action;
    if (filters?.entity) where.entity = filters.entity;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.startDate && filters?.endDate) {
      where.createdAt = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByEntity(entity: string, entityId: string, page = 1, limit = 10) {
    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { entity, entityId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByUser(userId: string, page = 1, limit = 10) {
    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRecentActivities(limit = 20) {
    return this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async clearOldLogs(daysOld: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - daysOld);
    
    const result = await this.auditLogRepository.delete({
      createdAt: Between(new Date(0), date),
    });
    return result.affected || 0;
  }
}
