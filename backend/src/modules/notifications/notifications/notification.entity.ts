import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum NotificationType {
  LOW_STOCK = 'low_stock',
  SYNC_ERROR = 'sync_error',
  API_ERROR = 'api_error',
  ORDER_STATUS = 'order_status',
  SYSTEM = 'system',
  INFO = 'info',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, default: NotificationType.INFO })
  type!: NotificationType;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  message!: string;

  @Column({ type: 'varchar', length: 20, default: NotificationPriority.MEDIUM })
  priority!: NotificationPriority;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'json', nullable: true })
  data!: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
