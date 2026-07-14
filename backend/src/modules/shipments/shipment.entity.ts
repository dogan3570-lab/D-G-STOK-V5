import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ShipmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
}

export enum ShipmentProvider {
  YURTICI = 'yurtici',
  ARAS = 'aras',
  MNG = 'mng',
  PTT = 'ptt',
  SURAT = 'surat',
  HOROZ = 'horoz',
  OTHER = 'other',
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  trackingNumber: string;

  @Column()
  orderId: string;

  @Column({ length: 50, default: ShipmentStatus.PENDING })
  status: ShipmentStatus;

  @Column({ length: 50, default: ShipmentProvider.OTHER })
  provider: ShipmentProvider;

  @Column({ length: 200 })
  recipientName: string;

  @Column({ length: 200 })
  recipientPhone: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  codAmount: number; // Kapida odeme tutari

  @Column({ nullable: true })
  estimatedDelivery: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
