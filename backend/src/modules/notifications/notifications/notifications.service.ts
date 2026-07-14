import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, NotificationPriority } from './notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async create(type: NotificationType, title: string, message?: string, priority?: NotificationPriority, data?: any): Promise<Notification> {
    const notification = this.notificationsRepository.create({ type, title, message, priority, data });
    return this.notificationsRepository.save(notification);
  }

  async findAll(page = 1, limit = 20) {
    const [data, total] = await this.notificationsRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUnread() {
    return this.notificationsRepository.find({
      where: { isRead: false },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationsRepository.update(id, { isRead: true });
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationsRepository.update({ isRead: false }, { isRead: true });
  }

  async getUnreadCount(): Promise<number> {
    return this.notificationsRepository.count({ where: { isRead: false } });
  }

  // Helper methods
  async sendLowStockAlert(productName: string, sku: string, stock: number, criticalStock: number) {
    return this.create(
      NotificationType.LOW_STOCK,
      `Kritik Stok: ${productName}`,
      `${sku} stogu kritik seviyede (Mevcut: ${stock}, Kritik: ${criticalStock})`,
      NotificationPriority.HIGH,
      { productName, sku, stock, criticalStock },
    );
  }

  async sendSyncError(marketplace: string, error: string) {
    return this.create(
      NotificationType.SYNC_ERROR,
      `${marketplace} Senkronizasyon Hatasi`,
      error,
      NotificationPriority.CRITICAL,
      { marketplace, error },
    );
  }

  async sendApiError(service: string, statusCode: number, error: string) {
    return this.create(
      NotificationType.API_ERROR,
      `${service} API Hatasi (${statusCode})`,
      error,
      NotificationPriority.CRITICAL,
      { service, statusCode, error },
    );
  }
}
