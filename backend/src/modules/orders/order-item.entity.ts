import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() orderId: string;
  @ManyToOne(() => Order, (order) => order.items) @JoinColumn({ name: 'orderId' }) order: Order;
  @Column() productId: string;
  @Column({ length: 200 }) productName: string;
  @Column({ length: 100 }) sku: string;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) unitPrice: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) totalPrice: number;
}
