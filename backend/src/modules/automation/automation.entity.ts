import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AutomationType {
  PRICE_UPDATE = 'price_update',
  STOCK_SYNC = 'stock_sync',
  PRODUCT_IMPORT = 'product_import',
  MARKETPLACE_SYNC = 'marketplace_sync',
  REPORT_GENERATION = 'report_generation',
  DISCOUNT_APPLY = 'discount_apply',
  INVENTORY_ALERT = 'inventory_alert',
}

export enum AutomationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RUNNING = 'running',
  FAILED = 'failed',
  PAUSED = 'paused',
}

export enum AutomationFrequency {
  EVERY_5_MIN = 'every_5_min',
  EVERY_15_MIN = 'every_15_min',
  EVERY_30_MIN = 'every_30_min',
  HOURLY = 'hourly',
  EVERY_2_HOURS = 'every_2_hours',
  EVERY_6_HOURS = 'every_6_hours',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('automations')
export class Automation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50 })
  @Index()
  type: AutomationType;

  @Column({ length: 50, default: AutomationStatus.ACTIVE })
  status: AutomationStatus;

  @Column({ length: 50 })
  frequency: AutomationFrequency;

  @Column({ type: 'json', nullable: true })
  config: Record<string, any>;

  @Column({ nullable: true })
  lastRunAt: Date;

  @Column({ nullable: true })
  lastRunResult: string;

  @Column({ nullable: true })
  nextRunAt: Date;

  @Column({ type: 'int', default: 0 })
  runCount: number;

  @Column({ type: 'int', default: 0 })
  failCount: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
